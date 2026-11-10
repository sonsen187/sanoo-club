import sys
import io
import asyncio
import edge_tts

# Ensure UTF-8 streams
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

async def generate_tts(text, voice, rate="+20%", pitch="+0Hz"):
    if voice == "male_deep":
        edge_voice = "vi-VN-NamMinhNeural"
    elif voice == "female_hype":
        edge_voice = "vi-VN-HoaiMyNeural"
    else:
        edge_voice = voice

    # Retry up to 2 times to handle transient Microsoft WebSocket hiccups
    last_err = None
    for attempt in range(2):
        try:
            comm = edge_tts.Communicate(text, edge_voice, rate=rate, pitch=pitch)
            chunks = []
            async for chunk in comm.stream():
                if chunk["type"] == "audio":
                    chunks.append(chunk["data"])
            if chunks:
                return b"".join(chunks)
        except Exception as e:
            last_err = e
            await asyncio.sleep(0.15)

    raise last_err or RuntimeError("No audio chunks received from Edge TTS")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python tts_engine.py <text> <voice> [rate] [pitch]", file=sys.stderr)
        sys.exit(1)

    text = sys.argv[1].strip()
    voice = sys.argv[2].strip()
    rate = sys.argv[3].strip() if len(sys.argv) > 3 else "+20%"
    pitch = sys.argv[4].strip() if len(sys.argv) > 4 else "+0Hz"

    try:
        data = asyncio.run(asyncio.wait_for(generate_tts(text, voice, rate, pitch), timeout=12.0))
        sys.stdout.buffer.write(data)
        sys.stdout.buffer.flush()
        sys.exit(0)
    except Exception as e:
        print(f"ERROR: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(2)
