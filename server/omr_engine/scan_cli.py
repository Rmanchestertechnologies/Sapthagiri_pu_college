#!/usr/bin/env python3
import sys
import os
import json
import argparse

# Ensure engine directory is on sys.path
ENGINE_DIR = os.path.dirname(os.path.abspath(__file__))
if ENGINE_DIR not in sys.path:
    sys.path.insert(0, ENGINE_DIR)

from scanner import process_omr

class SafeJsonEncoder(json.JSONEncoder):
    def default(self, obj):
        try:
            import numpy as np
            if isinstance(obj, (np.integer, np.floating, np.bool_)):
                return obj.item()
            if isinstance(obj, np.ndarray):
                return obj.tolist()
        except ImportError:
            pass
        from decimal import Decimal
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)

def main():
    parser = argparse.ArgumentParser(description="OMR Sheet Scanner CLI")
    parser.add_argument("--image", required=True, help="Path to OMR image file")
    parser.add_argument("--exam", default="neet", help="Exam type (neet, kcet, jee)")
    parser.add_argument("--template", default="", help="Optional explicit template path")

    args = parser.parse_args()

    if not os.path.exists(args.image):
        print(json.dumps({"success": False, "error": f"Image file not found: {args.image}"}))
        sys.exit(1)

    exam_type = (args.exam or "neet").strip().lower()
    if exam_type not in ["neet", "kcet", "jee"]:
        exam_type = "neet"

    template_path = args.template
    if not template_path or not os.path.exists(template_path):
        template_path = os.path.join(ENGINE_DIR, "templates", f"{exam_type}.json")

    if not os.path.exists(template_path):
        print(json.dumps({"success": False, "error": f"Template not found: {template_path}"}))
        sys.exit(1)

    try:
        with open(args.image, "rb") as f:
            image_bytes = f.read()

        if not image_bytes:
            print(json.dumps({"success": False, "error": "Image file is empty"}))
            sys.exit(1)

        result = process_omr(
            image_bytes,
            template_path,
            input_filename=os.path.basename(args.image)
        )

        identity = result.get("identity") or {}
        series_info = result.get("series") or {}
        detected_series = series_info.get("value") or identity.get("series") or None

        raw_answers = result.get("answers") or {}
        # Normalize answers to simple key-value: {"1": "A", "2": "C"}
        clean_answers = {}
        if isinstance(raw_answers, dict):
            if "mcq" in raw_answers or "numerical" in raw_answers:
                mcq = raw_answers.get("mcq") or {}
                numerical = raw_answers.get("numerical") or {}
                for q_num, val in mcq.items():
                    if isinstance(val, dict):
                        clean_answers[str(q_num)] = val.get("answer") or None
                    else:
                        clean_answers[str(q_num)] = val if val is not None else None
                for q_num, val in numerical.items():
                    if isinstance(val, dict):
                        clean_answers[str(q_num)] = val.get("value") or val.get("raw_answer") or None
                    else:
                        clean_answers[str(q_num)] = str(val) if val is not None else None
            else:
                for q_num, val in raw_answers.items():
                    if isinstance(val, dict):
                        clean_answers[str(q_num)] = val.get("answer") or val.get("value") or None
                    elif isinstance(val, str):
                        clean_answers[str(q_num)] = val
                    else:
                        clean_answers[str(q_num)] = None

        output = {
            "success": True,
            "roll_number": identity.get("roll_number") or "",
            "student_class": identity.get("class") or "",
            "detected_exam": identity.get("exam") or exam_type.upper(),
            "series": detected_series,
            "answers": clean_answers,
            "quality": result.get("quality") or {}
        }
        print(json.dumps(output, cls=SafeJsonEncoder))

    except Exception as err:
        print(json.dumps({"success": False, "error": str(err)}))
        sys.exit(1)

if __name__ == "__main__":
    main()
