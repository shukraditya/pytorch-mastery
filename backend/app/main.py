from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import problems, execute


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="PyTorch Mastery Backend", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(problems.router, prefix="/problems", tags=["problems"])
app.include_router(execute.router, prefix="/execute", tags=["execute"])
