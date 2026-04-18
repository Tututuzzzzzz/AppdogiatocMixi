package expo.modules.appprocessmetrics

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.BatteryManager
import android.os.Build
import android.os.Debug
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import kotlin.math.abs
import kotlin.math.pow
import kotlin.math.round

private data class BatteryDrainMetrics(
  val batteryDrainMilliwatts: Double?,
  val batteryDrainMahPerHour: Double?,
  val batteryCurrentMilliamps: Double?,
  val batteryVoltageVolts: Double?,
  val batteryIsCharging: Boolean?
)

class ExpoAppProcessMetricsModule : Module() {
  private var lastProcessTicks: Long? = null
  private var lastTotalTicks: Long? = null

  override fun definition() = ModuleDefinition {
    Name("ExpoAppProcessMetrics")

    AsyncFunction("getProcessCpuUsagePercent") {
      readProcessCpuUsagePercent()
    }

    AsyncFunction("getRuntimeMetrics") {
      readRuntimeMetrics()
    }

    AsyncFunction("resetCpuSampler") {
      lastProcessTicks = null
      lastTotalTicks = null
      true
    }
  }

  private fun readRuntimeMetrics(): Map<String, Any?> {
    val coreClockGhzList = readCurrentCoreFrequenciesGhz()
    val coreCount = Runtime.getRuntime().availableProcessors().takeIf { it > 0 }
    val threadCount = readThreadCount()
    val gpuUtilizationPercent = readGpuUtilizationPercent()
    val vramUsedBytes = readGraphicsMemoryBytes()
    val batteryDrain = readBatteryDrainMetrics()

    return mapOf(
      "cpuCoreClockGhzList" to coreClockGhzList,
      "cpuCoreCount" to coreCount,
      "threadCount" to threadCount,
      "gpuUtilizationPercent" to gpuUtilizationPercent,
      "vramUsedBytes" to vramUsedBytes,
      "batteryDrainMilliwatts" to batteryDrain.batteryDrainMilliwatts,
      "batteryDrainMahPerHour" to batteryDrain.batteryDrainMahPerHour,
      "batteryCurrentMilliamps" to batteryDrain.batteryCurrentMilliamps,
      "batteryVoltageVolts" to batteryDrain.batteryVoltageVolts,
      "batteryIsCharging" to batteryDrain.batteryIsCharging,
    )
  }

  private fun readProcessCpuUsagePercent(): Double? {
    val processTicks = readProcessTicks() ?: return null
    val totalTicks = readTotalCpuTicks() ?: return null

    val previousProcessTicks = lastProcessTicks
    val previousTotalTicks = lastTotalTicks

    lastProcessTicks = processTicks
    lastTotalTicks = totalTicks

    if (previousProcessTicks == null || previousTotalTicks == null) {
      return null
    }

    val deltaProcess = processTicks - previousProcessTicks
    val deltaTotal = totalTicks - previousTotalTicks

    if (deltaProcess < 0 || deltaTotal <= 0) {
      return null
    }

    val rawPercent = (deltaProcess.toDouble() / deltaTotal.toDouble()) * 100.0
    val clamped = rawPercent.coerceIn(0.0, 100.0)

    return roundToScale(clamped, 2)
  }

  private fun readCurrentCoreFrequenciesGhz(): List<Double>? {
    val cpuRoot = File("/sys/devices/system/cpu")
    val cpuDirs = cpuRoot.listFiles { file ->
      file.isDirectory && CPU_DIR_REGEX.matches(file.name)
    } ?: return null

    val values = cpuDirs
      .sortedBy { extractCpuIndex(it.name) ?: Int.MAX_VALUE }
      .mapNotNull { cpuDir ->
        val scalingFreq = readFirstLine("${cpuDir.path}/cpufreq/scaling_cur_freq")
        val cpuInfoFreq = readFirstLine("${cpuDir.path}/cpufreq/cpuinfo_cur_freq")
        val rawFreq = scalingFreq ?: cpuInfoFreq ?: return@mapNotNull null
        val khz = rawFreq.trim().toLongOrNull() ?: return@mapNotNull null
        if (khz <= 0L) {
          return@mapNotNull null
        }

        roundToScale(khz.toDouble() / 1_000_000.0, 3)
      }

    return values.takeIf { it.isNotEmpty() }
  }

  private fun readThreadCount(): Int? {
    val status = readFileText("/proc/self/status") ?: return null
    val line = status
      .lineSequence()
      .firstOrNull { it.startsWith("Threads:") }
      ?: return null

    val value = line
      .substringAfter("Threads:", "")
      .trim()
      .toIntOrNull()
      ?: return null

    return value.takeIf { it > 0 }
  }

  private fun readGpuUtilizationPercent(): Double? {
    readKgslGpuBusyPercent()?.let { return it }

    for (path in GPU_LOAD_PATHS) {
      parseGpuLoadPercent(readFirstLine(path))?.let { return it }
    }

    return null
  }

  private fun readKgslGpuBusyPercent(): Double? {
    val raw = readFirstLine("/sys/class/kgsl/kgsl-3d0/gpubusy") ?: return null
    val parts = raw
      .trim()
      .split(Regex("\\s+"))
      .mapNotNull { it.toLongOrNull() }

    if (parts.size < 2) {
      return null
    }

    val busy = parts[0]
    val total = parts[1]

    if (busy < 0L || total <= 0L) {
      return null
    }

    return roundToScale(((busy.toDouble() / total.toDouble()) * 100.0).coerceIn(0.0, 100.0), 1)
  }

  private fun parseGpuLoadPercent(raw: String?): Double? {
    if (raw.isNullOrBlank()) {
      return null
    }

    val numbers = GPU_NUMBER_REGEX
      .findAll(raw)
      .mapNotNull { it.value.toDoubleOrNull() }
      .toList()

    if (numbers.isEmpty()) {
      return null
    }

    val percent = if (
      raw.contains("busy", ignoreCase = true) &&
      raw.contains("total", ignoreCase = true) &&
      numbers.size >= 2 &&
      numbers[1] > 0.0
    ) {
      (numbers[0] / numbers[1]) * 100.0
    } else {
      numbers[0]
    }

    if (!percent.isFinite()) {
      return null
    }

    return roundToScale(percent.coerceIn(0.0, 100.0), 1)
  }

  private fun readGraphicsMemoryBytes(): Long? {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) {
      return null
    }

    return try {
      val memoryInfo = Debug.MemoryInfo()
      Debug.getMemoryInfo(memoryInfo)
      val graphicsKb = memoryInfo.memoryStats["summary.graphics"]?.toLongOrNull() ?: return null
      if (graphicsKb < 0L) {
        null
      } else {
        graphicsKb * 1024L
      }
    } catch (_: Exception) {
      null
    }
  }

  private fun readBatteryDrainMetrics(): BatteryDrainMetrics {
    val context = appContext.reactContext
      ?: return BatteryDrainMetrics(null, null, null, null, null)

    val batteryIntent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
    val status = batteryIntent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
    val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
      status == BatteryManager.BATTERY_STATUS_FULL

    val voltageMv = batteryIntent?.getIntExtra(BatteryManager.EXTRA_VOLTAGE, -1) ?: -1
    val voltageVolts = if (voltageMv > 0) {
      roundToScale(voltageMv.toDouble() / 1000.0, 3)
    } else {
      null
    }

    val batteryManager = context.getSystemService(Context.BATTERY_SERVICE) as? BatteryManager
    val currentUaRaw = batteryManager?.getLongProperty(BatteryManager.BATTERY_PROPERTY_CURRENT_NOW)
    val currentUa = currentUaRaw?.takeIf { it != Long.MIN_VALUE && it != 0L }

    val currentMilliampsRaw = currentUa?.let { abs(it.toDouble()) / 1000.0 }
    val currentMilliamps = currentMilliampsRaw?.let { roundToScale(it, 1) }

    val drainMahPerHour = if (isCharging) {
      0.0
    } else {
      currentMilliamps
    }

    val drainMilliwatts = if (isCharging) {
      0.0
    } else if (currentMilliampsRaw != null && voltageMv > 0) {
      roundToScale((currentMilliampsRaw * voltageMv.toDouble()) / 1000.0, 1)
    } else {
      null
    }

    return BatteryDrainMetrics(
      batteryDrainMilliwatts = drainMilliwatts,
      batteryDrainMahPerHour = drainMahPerHour,
      batteryCurrentMilliamps = currentMilliamps,
      batteryVoltageVolts = voltageVolts,
      batteryIsCharging = isCharging,
    )
  }

  private fun extractCpuIndex(cpuDirName: String): Int? {
    val match = CPU_DIR_INDEX_REGEX.matchEntire(cpuDirName) ?: return null
    return match.groupValues.getOrNull(1)?.toIntOrNull()
  }

  private fun readFileText(path: String): String? {
    return try {
      File(path).bufferedReader().use { it.readText() }
    } catch (_: Exception) {
      null
    }
  }

  private fun roundToScale(value: Double, scale: Int): Double {
    val factor = 10.0.pow(scale)
    return round(value * factor) / factor
  }

  private fun readProcessTicks(): Long? {
    val stat = readFirstLine("/proc/self/stat") ?: return null
    val closeParen = stat.lastIndexOf(')')
    if (closeParen < 0 || closeParen + 2 >= stat.length) {
      return null
    }

    val tail = stat.substring(closeParen + 2).trim()
    val fields = tail.split(Regex("\\s+"))
    if (fields.size <= 12) {
      return null
    }

    val utime = fields[11].toLongOrNull() ?: return null
    val stime = fields[12].toLongOrNull() ?: return null

    return utime + stime
  }

  private fun readTotalCpuTicks(): Long? {
    val stat = readFirstLine("/proc/stat") ?: return null
    val fields = stat.trim().split(Regex("\\s+"))
    if (fields.isEmpty() || fields[0] != "cpu") {
      return null
    }

    return fields.drop(1).sumOf { it.toLongOrNull() ?: 0L }
  }

  private fun readFirstLine(path: String): String? {
    return try {
      File(path).bufferedReader().use { it.readLine() }
    } catch (_: Exception) {
      null
    }
  }

  companion object {
    private val CPU_DIR_REGEX = Regex("cpu\\d+")
    private val CPU_DIR_INDEX_REGEX = Regex("cpu(\\d+)")
    private val GPU_NUMBER_REGEX = Regex("-?\\d+(\\.\\d+)?")

    private val GPU_LOAD_PATHS = listOf(
      "/sys/class/kgsl/kgsl-3d0/devfreq/gpu_load",
      "/sys/class/devfreq/gpufreq/gpu_load",
      "/sys/class/misc/mali0/device/utilization",
      "/sys/devices/platform/mali/utilization",
      "/sys/devices/platform/11800000.g3d/utilization",
    )
  }
}
