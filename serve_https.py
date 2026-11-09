"""Serve this folder over HTTPS (Safari on iOS may refuse plain http).

Usage: python3 serve_https.py [port]   (default 8443)
Uses the self-signed certificate in .cert/ (not committed to git).
"""
import http.server, os, ssl, sys

os.chdir(os.path.dirname(os.path.abspath(__file__)))
port = int(sys.argv[1]) if len(sys.argv) > 1 else 8443
httpd = http.server.ThreadingHTTPServer(("0.0.0.0", port), http.server.SimpleHTTPRequestHandler)
ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(".cert/cert.pem", ".cert/key.pem")
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"Serving https on port {port}", flush=True)
httpd.serve_forever()
