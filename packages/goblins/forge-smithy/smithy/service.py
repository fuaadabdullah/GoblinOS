from fastapi import FastAPI
from .doctor import run as doctor_run
from .bootstrap import run as bootstrap_run
from .config import sync as config_sync
from .tasks import check as tasks_check

app = FastAPI(title="Forge Guild Service")

@app.get("/health")
def health():
    return {"status": "healthy", "service": "forge-guild"}

@app.post("/forge-guild/doctor")
def doctor():
    doctor_run()
    return {"ok": True}

@app.post("/forge-guild/bootstrap")
def bootstrap():
    bootstrap_run()
    return {"ok": True}

@app.post("/forge-guild/sync-config")
def sync_config():
    config_sync()
    return {"ok": True}

@app.post("/forge-guild/check")
def check():
    tasks_check()
    return {"ok": True}
