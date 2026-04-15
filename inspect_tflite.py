#!/usr/bin/env python3
"""
inspect_tflite.py
-----------------
Đọc file .tflite, in ra thông tin input/output quantization (scale, zero_point,
tensor shape, dtype) rồi sinh sẵn nội dung file .env cho Expo / React-Native.

Cách dùng:
    python inspect_tflite.py [đường-dẫn-tới-file.tflite]

Ví dụ:
    python inspect_tflite.py frontend/assets/models/2D_64_int8.tflite

Nếu không truyền tham số, script tự dùng đường dẫn mặc định bên dưới.
"""

import sys
import os
import struct
import pathlib

# ──────────────────────────────────────────────────────────────────────────────
# Đường dẫn mặc định
# ──────────────────────────────────────────────────────────────────────────────
DEFAULT_MODEL_PATH = "frontend/assets/models/2D_64_int8.tflite"

# ──────────────────────────────────────────────────────────────────────────────
# FlatBuffers minimal reader (không cần cài thêm thư viện)
# ──────────────────────────────────────────────────────────────────────────────

def read_u32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<I", data, offset)[0]

def read_i32(data: bytes, offset: int) -> int:
    return struct.unpack_from("<i", data, offset)[0]

def read_float(data: bytes, offset: int) -> float:
    return struct.unpack_from("<f", data, offset)[0]

def read_vector(data: bytes, base: int):
    """Đọc FlatBuffers vector: trả về (offset_list, length)."""
    len_ = read_u32(data, base)
    offsets = [base + 4 + i * 4 for i in range(len_)]
    return offsets, len_

def read_string(data: bytes, offset: int) -> str:
    """Đọc FlatBuffers string tại vị trí offset."""
    abs_off = offset + read_u32(data, offset)
    length = read_u32(data, abs_off)
    return data[abs_off + 4: abs_off + 4 + length].decode("utf-8", errors="replace")


# ──────────────────────────────────────────────────────────────────────────────
# Bảng mã TFLite TensorType
# ──────────────────────────────────────────────────────────────────────────────
TFLITE_TYPES = {
    0: "float32",
    1: "float16",
    2: "int32",
    3: "uint8",
    4: "int64",
    5: "string",
    6: "bool",
    7: "int16",
    8: "complex64",
    9: "int8",
    10: "float64",
    11: "complex128",
    16: "uint32",
    255: "resource",
}


# ──────────────────────────────────────────────────────────────────────────────
# Parser FlatBuffer TFLite schema (đơn giản hoá)
# ──────────────────────────────────────────────────────────────────────────────

class TensorInfo:
    def __init__(self):
        self.name: str = ""
        self.dtype: str = "unknown"
        self.shape: list[int] = []
        self.scale: float = 0.0
        self.zero_point: int = 0
        self.has_quant: bool = False


def parse_tflite(model_path: str) -> tuple[list[TensorInfo], list[TensorInfo]]:
    """
    Phân tích file .tflite và trả về (input_tensors, output_tensors).
    Dùng FlatBuffers thủ công — không phụ thuộc vào thư viện ngoài.
    Nếu cần kết quả chính xác hơn, hãy cài: pip install flatbuffers tflite
    """
    data = pathlib.Path(model_path).read_bytes()

    # Root offset
    root_offset = read_u32(data, 0)
    model_base = root_offset  # Model table

    # vtable
    vt_offset = model_base - read_i32(data, model_base)
    vt_size   = read_u32(data, vt_offset)        # không dùng trực tiếp

    def field_offset(table_base: int, field_id: int) -> int | None:
        """Trả về absolute offset của field trong FlatBuffers table, hoặc None."""
        vt = table_base - read_i32(data, table_base)
        vt_sz = struct.unpack_from("<H", data, vt)[0]
        field_word_offset = 4 + field_id * 2
        if field_word_offset + 2 > vt_sz:
            return None
        rel = struct.unpack_from("<H", data, vt + field_word_offset)[0]
        if rel == 0:
            return None
        return table_base + rel

    # ── Model → subgraphs (field 4 trong Model schema, index 3 tính từ 0)
    # Model fields: version(0), operator_codes(1), subgraphs(2), description(3), ...
    sg_field = field_offset(model_base, 3)  # field index 3 = subgraphs
    if sg_field is None:
        raise RuntimeError("Không tìm thấy trường subgraphs trong model.")

    sg_vec_start = sg_field + read_u32(data, sg_field)   # absolute start of vector body
    n_subgraphs  = read_u32(data, sg_vec_start)
    if n_subgraphs == 0:
        raise RuntimeError("Model không có subgraph nào.")

    # Chỉ lấy subgraph 0
    sg_ref_off  = sg_vec_start + 4                        # offset of first element ref
    sg_abs_off  = sg_ref_off + read_u32(data, sg_ref_off) # absolute SubGraph table

    def sg_field_offset(fid: int) -> int | None:
        return field_offset(sg_abs_off, fid)

    # SubGraph fields: tensors(0), inputs(1), outputs(2), operators(3), name(4)
    tensors_f = sg_field_offset(0)
    inputs_f  = sg_field_offset(1)
    outputs_f = sg_field_offset(2)

    if tensors_f is None or inputs_f is None or outputs_f is None:
        raise RuntimeError("Subgraph thiếu tensors / inputs / outputs.")

    # Tensor index lists
    def read_int_vec(vec_field_abs: int) -> list[int]:
        vec_start = vec_field_abs + read_u32(data, vec_field_abs)
        count     = read_u32(data, vec_start)
        return [read_i32(data, vec_start + 4 + i * 4) for i in range(count)]

    input_indices  = read_int_vec(inputs_f)
    output_indices = read_int_vec(outputs_f)

    # Parse tensors vector
    tens_vec_start = tensors_f + read_u32(data, tensors_f)
    n_tensors      = read_u32(data, tens_vec_start)

    tensors: list[TensorInfo] = []
    for i in range(n_tensors):
        ref_off  = tens_vec_start + 4 + i * 4
        t_abs    = ref_off + read_u32(data, ref_off)   # absolute Tensor table

        ti = TensorInfo()

        # name (field 0)
        nf = field_offset(t_abs, 0)
        if nf is not None:
            ti.name = read_string(data, nf)

        # type (field 1) — UInt32
        typef = field_offset(t_abs, 1)
        if typef is not None:
            ti.dtype = TFLITE_TYPES.get(read_u32(data, typef), "unknown")
        else:
            ti.dtype = "float32"   # default if omitted

        # shape (field 2) — vector<int32>
        shapef = field_offset(t_abs, 2)
        if shapef is not None:
            ti.shape = read_int_vec(shapef)

        # quantization (field 3)
        quantf = field_offset(t_abs, 3)
        if quantf is not None:
            q_abs = quantf + read_u32(data, quantf)
            # QuantizationParameters: min(0), max(1), scale(2), zero_point(3)
            sf = field_offset(q_abs, 2)   # scale vector
            zf = field_offset(q_abs, 3)   # zero_point vector
            if sf is not None:
                sv_start = sf + read_u32(data, sf)
                if read_u32(data, sv_start) > 0:
                    ti.scale     = read_float(data, sv_start + 4)
                    ti.has_quant = True
            if zf is not None:
                zv_start = zf + read_u32(data, zf)
                if read_u32(data, zv_start) > 0:
                    ti.zero_point = read_i32(data, zv_start + 4)
                    ti.has_quant  = True

        tensors.append(ti)

    inputs  = [tensors[i] for i in input_indices  if i < len(tensors)]
    outputs = [tensors[i] for i in output_indices if i < len(tensors)]
    return inputs, outputs


# ──────────────────────────────────────────────────────────────────────────────
# Sinh .env
# ──────────────────────────────────────────────────────────────────────────────

def dtype_to_env(dtype: str) -> str:
    if dtype in ("int8",):
        return "int8"
    if dtype in ("uint8",):
        return "uint8"
    return "float32"


def infer_layout_from_shape(shape: list[int], n_channels: int) -> str:
    """
    shape thường là [1, window, channels].
    Trả về chuỗi layout: 'x,y,z' hoặc 'x,y,z,m' v.v.
    """
    channel_map = {1: "m", 2: "x,y", 3: "x,y,z", 4: "x,y,z,m"}
    return channel_map.get(n_channels, ",".join(f"ch{i}" for i in range(n_channels)))


def generate_env(model_path: str,
                 inputs: list[TensorInfo],
                 outputs: list[TensorInfo]) -> str:
    inp = inputs[0]  if inputs  else TensorInfo()
    out = outputs[0] if outputs else TensorInfo()

    # Window size: thường là chiều thứ 2 của shape [1, window, channels]
    window_size = 64
    channels    = 3
    layout      = "x,y,z"

    if len(inp.shape) >= 3:
        window_size = inp.shape[1]
        channels    = inp.shape[2]
        layout      = infer_layout_from_shape(inp.shape, channels)
    elif len(inp.shape) == 2:
        # [window, channels]
        window_size = inp.shape[0]
        channels    = inp.shape[1]
        layout      = infer_layout_from_shape(inp.shape, channels)

    inp_scale  = inp.scale      if inp.has_quant  else 1.0
    inp_zp     = inp.zero_point if inp.has_quant  else 0
    out_scale  = out.scale      if out.has_quant  else 1.0
    out_zp     = out.zero_point if out.has_quant  else 0
    inp_type   = dtype_to_env(inp.dtype)
    out_type   = dtype_to_env(out.dtype)

    lines = [
        "# ════════════════════════════════════════════════════════════════════",
        f"# Tự sinh bởi: inspect_tflite.py  ←  {os.path.basename(model_path)}",
        "# Dán vào: frontend/.env",
        "# ════════════════════════════════════════════════════════════════════",
        "",
        "# ── TinyML model (bundle asset) ──────────────────────────────────────",
        "# Để trống nếu dùng asset bundled (require() trong tinyml-model-asset.ts)",
        "EXPO_PUBLIC_TINYML_MODEL_URL=",
        "",
        "# ── Input tensor ──────────────────────────────────────────────────────",
        f"EXPO_PUBLIC_TINYML_WINDOW_SIZE={window_size}",
        f"# Thứ tự kênh gia tốc kế đưa vào model: {layout}",
        f"EXPO_PUBLIC_TINYML_INPUT_LAYOUT={layout}",
        f"EXPO_PUBLIC_TINYML_INPUT_TYPE={inp_type}",
        f"EXPO_PUBLIC_TINYML_INPUT_SCALE={inp_scale}",
        f"EXPO_PUBLIC_TINYML_INPUT_ZERO_POINT={inp_zp}",
        "",
        "# ── Output tensor ─────────────────────────────────────────────────────",
        f"EXPO_PUBLIC_TINYML_OUTPUT_TYPE={out_type}",
        f"EXPO_PUBLIC_TINYML_OUTPUT_SCALE={out_scale}",
        f"EXPO_PUBLIC_TINYML_OUTPUT_ZERO_POINT={out_zp}",
        "",
    ]
    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    model_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_MODEL_PATH

    if not os.path.isfile(model_path):
        print(f"[ERROR] Không tìm thấy file: {model_path}", file=sys.stderr)
        sys.exit(1)

    print(f"\n{'='*60}")
    print(f"  inspect_tflite.py  →  {model_path}")
    print(f"{'='*60}\n")

    try:
        inputs, outputs = parse_tflite(model_path)
    except Exception as exc:  # noqa: BLE001
        print(f"[ERROR] Không parse được FlatBuffers: {exc}", file=sys.stderr)
        print("Hãy thử cài thư viện: pip install flatbuffers tflite", file=sys.stderr)
        sys.exit(1)

    def fmt_tensor(ti: TensorInfo, role: str) -> None:
        quant_str = (
            f"scale={ti.scale:.8g}, zero_point={ti.zero_point}"
            if ti.has_quant
            else "không có quantization"
        )
        print(f"  [{role}] {ti.name or '(no name)'}")
        print(f"    dtype : {ti.dtype}")
        print(f"    shape : {ti.shape}")
        print(f"    quant : {quant_str}")

    print("─── Input tensors ───────────────────────────────────────────")
    for t in inputs:
        fmt_tensor(t, "INPUT")

    print("\n─── Output tensors ──────────────────────────────────────────")
    for t in outputs:
        fmt_tensor(t, "OUTPUT")

    env_content = generate_env(model_path, inputs, outputs)
    env_path = os.path.join(os.path.dirname(model_path), "..", "..", "..", "frontend", ".env")
    env_path = os.path.normpath(env_path)

    print("\n" + "─" * 60)
    print("  Nội dung .env được sinh ra (frontend/.env):")
    print("─" * 60)
    print(env_content)

    # Ghi file .env
    try:
        with open(env_path, "w", encoding="utf-8") as f:
            f.write(env_content)
        print(f"[OK] Đã ghi: {env_path}")
    except OSError as e:
        print(f"[WARN] Không ghi được file tự động: {e}")
        print("[WARN] Hãy copy nội dung trên và dán vào frontend/.env thủ công.")


if __name__ == "__main__":
    main()
