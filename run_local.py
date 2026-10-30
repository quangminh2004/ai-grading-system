"""
Chạy hệ thống Chấm & Chữa Bài AI trên máy cục bộ.
Hỗ trợ cả chạy máy chủ Node.js Backend (chứa Web App + API + MongoDB Atlas)
hoặc chạy máy chủ tĩnh phục vụ thư mục dist.
"""

import argparse
import os
import shutil
import subprocess
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

VS_NODE_DIR = r"C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
if os.path.isdir(VS_NODE_DIR) and VS_NODE_DIR not in os.environ.get("PATH", ""):
    os.environ["PATH"] = VS_NODE_DIR + os.pathsep + os.environ.get("PATH", "")


def find_node():
    return shutil.which("node")


def main():
    parser = argparse.ArgumentParser(description="Chạy hệ thống Chấm & Chữa Bài AI.")
    parser.add_argument("--port", type=int, default=5000, help="Cổng chạy ứng dụng (mặc định 5000)")
    parser.add_argument("--static-only", action="store_true", help="Chỉ chạy server tĩnh Python (không có API MongoDB)")
    args = parser.parse_args()

    project_root = Path(__file__).resolve().parent
    backend_dir = project_root / "backend"
    node_exe = find_node()

    if not args.static_only and node_exe and (backend_dir / "src" / "server.js").is_file():
        print("=" * 65)
        print("🚀 Đang khởi động Hệ thống Chấm & Chữa Bài AI (Node.js + MongoDB Atlas)...")
        print("🌐 Địa chỉ truy cập: http://localhost:5000")
        print("👑 Tài khoản Admin: admin / admin@123 (Dữ liệu thật MongoDB Atlas)")
        print("💡 Đăng nhập Admin để tạo tài khoản cho các cô giáo")
        print("=" * 65)
        env = os.environ.copy()
        env["PORT"] = str(args.port)
        try:
            subprocess.run([node_exe, "src/server.js"], cwd=str(backend_dir), env=env)
        except KeyboardInterrupt:
            print("\nĐã dừng hệ thống.")
        return

    # Fallback chạy server tĩnh Python
    public_dir = project_root / "dist"
    if not (public_dir / "index.html").is_file():
        parser.error("Thiếu thư mục dist/index.html.")
    handler = partial(SimpleHTTPRequestHandler, directory=str(public_dir))
    try:
        server = ThreadingHTTPServer(("127.0.0.1", args.port), handler)
    except OSError as exc:
        parser.exit(1, f"Cannot start server: {exc}\nTry a different --port.\n")
    print(f"Static web server: http://localhost:{args.port}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
