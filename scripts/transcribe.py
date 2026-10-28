"""Transcreve um áudio com faster-whisper (CPU) e imprime só o texto em stdout.

Uso: transcribe.py <arquivo> [--model small] [--language pt]
O PyAV embutido lê .oga/Opus do Telegram, então não precisa de ffmpeg.
"""
import argparse
import sys

from faster_whisper import WhisperModel


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("audio")
    ap.add_argument("--model", default="small")
    ap.add_argument("--language", default="pt")
    # Nomes próprios que o Whisper erra sem pista (initial_prompt do faster-whisper).
    ap.add_argument("--vocab", default="Bison, VRX, Relay, Claude, Tailscale, Telegram.")
    args = ap.parse_args()

    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    segments, _ = model.transcribe(
        args.audio,
        language=None if args.language == "auto" else args.language,
        vad_filter=True,
        initial_prompt=args.vocab or None,
    )
    text = " ".join(s.text.strip() for s in segments).strip()
    sys.stdout.reconfigure(encoding="utf-8")
    print(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
