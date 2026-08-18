from __future__ import annotations

import asyncio
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from contextlib import asynccontextmanager

from routers import router

app = FastAPI(title="SPINE Building Service API", version="0.1.0")

frontend_origin_env = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
frontend_origins = [o.strip() for o in frontend_origin_env.split(",") if o.strip()]
if not frontend_origins:
	frontend_origins = ["http://localhost:5173"]

default_dev_origins = [
	"http://localhost:5173",
	"http://127.0.0.1:5173",
	"http://localhost:8080",
	"http://127.0.0.1:8080",
]

allow_origins = list(dict.fromkeys([*frontend_origins, *default_dev_origins]))

app.add_middleware(
	CORSMiddleware,
	allow_origins=allow_origins,
	allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$",
	allow_credentials=True,
	allow_methods=["*"],
	allow_headers=["*"],
)

app.include_router(router)
