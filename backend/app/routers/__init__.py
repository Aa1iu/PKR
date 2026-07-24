"""API 路由"""

from . import kbs, docs, graph, chat, search

ROUTERS = [kbs.router, docs.router, graph.router, chat.router, search.router]
