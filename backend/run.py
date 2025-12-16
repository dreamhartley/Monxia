#!/usr/bin/env python
"""
启动后端服务
"""
from app import app

if __name__ == '__main__':
    print("=" * 50)
    print("梦匣 Monxia - 后端 API 服务")
    print("=" * 50)
    print("API 运行在: http://localhost:5000")
    print("健康检查: http://localhost:5000/api/health")
    print("=" * 50)
    app.run(debug=True, host='0.0.0.0', port=5000)
