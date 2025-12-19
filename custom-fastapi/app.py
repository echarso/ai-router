from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import os
import time
import uuid

app = FastAPI(title="Custom OpenAI-Compatible API")
MODEL_ID = os.getenv("MODEL_ID", "fast-api")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/v1/models")
def list_models():
    return {
        "object": "list",
        "data": [
            {
                "id": MODEL_ID,
                "object": "model",
                "created": int(time.time()),
                "owned_by": "custom-fastapi",
            }
            ,
            # Backwards-compat with earlier routing configs
            {
                "id": "custom_model",
                "object": "model",
                "created": int(time.time()),
                "owned_by": "custom-fastapi",
            },
        ],
    }


@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    payload = await request.json()
    requested_model = payload.get("model") or MODEL_ID
    content = "den katew tipota"
    return JSONResponse(
        {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion",
            "created": int(time.time()),
            "model": requested_model,
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": content},
                    "finish_reason": "stop",
                }
            ],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }
    )


@app.post("/v1/completions")
async def completions(request: Request):
    payload = await request.json()
    requested_model = payload.get("model") or MODEL_ID
    text = "den katew tipota"
    return JSONResponse(
        {
            "id": f"cmpl-{uuid.uuid4().hex[:12]}",
            "object": "text_completion",
            "created": int(time.time()),
            "model": requested_model,
            "choices": [{"text": text, "index": 0, "finish_reason": "stop", "logprobs": None}],
            "usage": {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
        }
    )

