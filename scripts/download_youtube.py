import sys
import os
import json
import locale

# Enforce UTF-8 encoding on Windows standard streams and locale to eliminate 'charmap' errors completely
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"
os.environ["LANG"] = "en_US.UTF-8"
os.environ["LC_ALL"] = "en_US.UTF-8"

try:
    locale.getpreferredencoding = lambda *args, **kwargs: 'utf-8'
except Exception:
    pass

for stream in (sys.stdout, sys.stderr, sys.stdin):
    if hasattr(stream, 'reconfigure'):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except Exception:
            pass

import yt_dlp

class SafeYTDLLogger:
    """Custom logger that intercepts yt-dlp internal messages to prevent raw writes to Windows charmap streams."""
    def __init__(self):
        self.errors = []
        self.warnings = []

    def debug(self, msg):
        pass

    def info(self, msg):
        pass

    def warning(self, msg):
        try:
            self.warnings.append(str(msg))
        except Exception:
            pass

    def error(self, msg):
        try:
            self.errors.append(str(msg))
        except Exception:
            pass

def process_youtube(url, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    logger = SafeYTDLLogger()
    
    # 1. Extract video metadata without downloading
    ydl_opts_info = {
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'encoding': 'utf-8',
        'logger': logger,
        'windowsfilenames': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts_info) as ydl:
        info = ydl.extract_info(url, download=False)
        video_id = info.get('id')
        title = info.get('title', 'YouTube Track')
        duration = info.get('duration', 0)
        uploader = info.get('uploader', 'Unknown Artist')
        thumbnail = info.get('thumbnail', '')
        
    out_filename = f"{video_id}.mp3"
    out_filepath = os.path.join(output_dir, out_filename)
    rel_url = f"/assets/music/youtube/{out_filename}"
    
    # If already downloaded, return cached data immediately
    if os.path.exists(out_filepath) and os.path.getsize(out_filepath) > 1000:
        return {
            "success": True,
            "cached": True,
            "videoId": video_id,
            "title": title,
            "duration": duration,
            "uploader": uploader,
            "thumbnail": thumbnail,
            "filename": f"youtube/{out_filename}",
            "url": rel_url
        }
        
    # 2. Download audio stream and convert to mp3
    download_logger = SafeYTDLLogger()
    ydl_opts_download = {
        'format': 'bestaudio/best',
        'outtmpl': os.path.join(output_dir, f"{video_id}.%(ext)s"),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'quiet': True,
        'no_warnings': True,
        'noprogress': True,
        'encoding': 'utf-8',
        'logger': download_logger,
        'windowsfilenames': True
    }
    
    with yt_dlp.YoutubeDL(ydl_opts_download) as ydl:
        ydl.download([url])
        
    if os.path.exists(out_filepath):
        return {
            "success": True,
            "cached": False,
            "videoId": video_id,
            "title": title,
            "duration": duration,
            "uploader": uploader,
            "thumbnail": thumbnail,
            "filename": f"youtube/{out_filename}",
            "url": rel_url
        }
    else:
        # Check if file was saved with another extension
        for f in os.listdir(output_dir):
            if f.startswith(video_id):
                actual_rel = f"/assets/music/youtube/{f}"
                return {
                    "success": True,
                    "cached": False,
                    "videoId": video_id,
                    "title": title,
                    "duration": duration,
                    "uploader": uploader,
                    "thumbnail": thumbnail,
                    "filename": f"youtube/{f}",
                    "url": actual_rel
                }
        error_detail = download_logger.errors[-1] if download_logger.errors else "Không tìm thấy file audio sau khi tải"
        return {"success": False, "error": error_detail}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python download_youtube.py <url> <output_dir>"}, ensure_ascii=True))
        sys.exit(1)
        
    url = sys.argv[1]
    out_dir = sys.argv[2]
    
    try:
        res = process_youtube(url, out_dir)
        print(json.dumps(res, ensure_ascii=True))
    except Exception as e:
        err_str = str(e)
        # Fallback sanitize to ASCII if any raw encoding error slipped through
        try:
            err_str = err_str.encode('ascii', 'backslashreplace').decode('ascii')
        except Exception:
            pass
        print(json.dumps({"success": False, "error": err_str}, ensure_ascii=True))
        sys.exit(1)
