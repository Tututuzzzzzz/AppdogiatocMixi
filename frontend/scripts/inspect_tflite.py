from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import tflite


@dataclass(frozen=True)
class TensorInfo:
    index: int
    name: str
    tensor_type: str
    shape: tuple[int, ...]
    scale: float | None
    zero_point: int | None


def parse_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.exists():
        return values

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip()

    return values


def tensor_type_name(value: int) -> str:
    enum_map = {
        getattr(tflite.TensorType, name): name
        for name in dir(tflite.TensorType)
        if name.isupper() and not name.startswith("_")
    }
    return enum_map.get(value, str(value))


def tensor_shape(tensor: Any) -> tuple[int, ...]:
    shape = tensor.ShapeAsNumpy()
    if shape is None:
        return ()
    return tuple(int(item) for item in shape.tolist())


def tensor_quantization(tensor: Any) -> tuple[float | None, int | None]:
    quantization = tensor.Quantization()
    if quantization is None:
        return None, None

    scale = None
    zero_point = None

    if quantization.ScaleLength() > 0:
        scale = float(quantization.Scale(0))

    if quantization.ZeroPointLength() > 0:
        zero_point = int(quantization.ZeroPoint(0))

    return scale, zero_point


def read_tensor_info(model: Any, tensor_index: int) -> TensorInfo:
    subgraph = model.Subgraphs(0)
    tensor = subgraph.Tensors(tensor_index)
    name = tensor.Name().decode("utf-8") if tensor.Name() else ""
    tensor_type = tensor_type_name(int(tensor.Type()))
    shape = tensor_shape(tensor)
    scale, zero_point = tensor_quantization(tensor)

    return TensorInfo(
        index=tensor_index,
        name=name,
        tensor_type=tensor_type,
        shape=shape,
        scale=scale,
        zero_point=zero_point,
    )


def read_model(model_path: Path) -> Any:
    buffer = model_path.read_bytes()
    return tflite.Model.GetRootAsModel(buffer, 0)


def format_tensor(info: TensorInfo) -> str:
    return (
        f"index={info.index}, name={info.name!r}, type={info.tensor_type}, "
        f"shape={list(info.shape)}, scale={info.scale}, zero_point={info.zero_point}"
    )


def compare(expected: dict[str, str], actual: TensorInfo, prefix: str) -> list[str]:
    failures: list[str] = []

    def expect(key: str) -> str | None:
        value = expected.get(key)
        return value if value is not None and value != "" else None

    if (value := expect(f"EXPO_PUBLIC_TINYML_{prefix}_TYPE")) and value.lower() != actual.tensor_type.lower():
        failures.append(f"{prefix.lower()} type mismatch: env={value} model={actual.tensor_type}")

    if (value := expect(f"EXPO_PUBLIC_TINYML_{prefix}_SCALE")) is not None and actual.scale is not None:
        if abs(float(value) - actual.scale) > 1e-8:
            failures.append(f"{prefix.lower()} scale mismatch: env={value} model={actual.scale}")

    if (value := expect(f"EXPO_PUBLIC_TINYML_{prefix}_ZERO_POINT")) is not None and actual.zero_point is not None:
        if int(float(value)) != actual.zero_point:
            failures.append(f"{prefix.lower()} zero_point mismatch: env={value} model={actual.zero_point}")

    return failures


def main() -> int:
    parser = argparse.ArgumentParser(description="Inspect a TFLite model and compare it with frontend/.env values.")
    parser.add_argument(
        "model",
        nargs="?",
        default="assets/models/2Dv2_64_relu_int8.tflite",
        help="Path to the .tflite model file.",
    )
    parser.add_argument(
        "--env",
        default=".env",
        help="Path to the frontend .env file.",
    )
    args = parser.parse_args()

    model_path = Path(args.model).resolve()
    env_path = Path(args.env).resolve()

    if not model_path.exists():
        raise SystemExit(f"Model file not found: {model_path}")

    model = read_model(model_path)
    subgraph = model.Subgraphs(0)
    input_index = int(subgraph.Inputs(0))
    output_index = int(subgraph.Outputs(0))

    input_info = read_tensor_info(model, input_index)
    output_info = read_tensor_info(model, output_index)
    env_values = parse_env_file(env_path)

    print(f"Model: {model_path}")
    print(f"Version: {model.Version()}")
    print(f"Inputs: {subgraph.InputsLength()}, Outputs: {subgraph.OutputsLength()}")
    print(f"Input tensor: {format_tensor(input_info)}")
    print(f"Output tensor: {format_tensor(output_info)}")

    expected_window = env_values.get("EXPO_PUBLIC_TINYML_WINDOW_SIZE")
    expected_model_url = env_values.get("EXPO_PUBLIC_TINYML_MODEL_URL", "")

    mismatches: list[str] = []

    if expected_window and len(input_info.shape) >= 2:
        window_size = input_info.shape[-2]
        if int(expected_window) != window_size:
            mismatches.append(f"window size mismatch: env={expected_window} model={window_size} (shape {input_info.shape})")

    if env_values.get("EXPO_PUBLIC_TINYML_INPUT_LAYOUT"):
        print(f"Input layout in env: {env_values['EXPO_PUBLIC_TINYML_INPUT_LAYOUT']} (semantic setting, not directly encoded in the flatbuffer)")

    mismatches.extend(compare(env_values, input_info, "INPUT"))
    mismatches.extend(compare(env_values, output_info, "OUTPUT"))

    if expected_model_url:
        print(f"Model URL configured in env: {expected_model_url}")
    else:
        print("Model URL not set in env, so app uses the bundled require() asset.")

    if mismatches:
        print("Mismatch summary:")
        for item in mismatches:
            print(f"- {item}")
        return 1

    print("Env values match the model metadata for the checked fields.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())