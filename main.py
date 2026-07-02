from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes.scenarios import router as scenarios_router
from . import db

app = FastAPI(title="MDS Scenario Engine API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    db.init_db()


@app.get("/")
def root():
    return {"status": "ok", "service": "mds-scenario-engine"}


app.include_router(scenarios_router, prefix="/api")
