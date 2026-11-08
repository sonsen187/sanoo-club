import sys
import os
import json
import yt_dlp

def process_youtube(url, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    # Extract info
    ydl_opts_info = {
        'quiet': True,
        'no_warnings': True,
        'noprogress': True
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
    
    # If already exists, return cached
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
        
    # Download audio and convert to mp3
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
        'noprogress': True
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
        return {"success": False, "error": "Output file not found after download"}

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python download_youtube.py <url> <output_dir>"}))
        sys.exit(1)
        
    url = sys.argv[1]
    out_dir = sys.argv[2]
    
    try:
        res = process_youtube(url, out_dir)
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}, ensure_ascii=False))
        sys.exit(1)
