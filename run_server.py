"""Start the API + frontend. Default port 8765 avoids Windows reserved ranges on 8000."""
import os

import uvicorn

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8765"))
    host = os.environ.get("HOST", "127.0.0.1")
    uvicorn.run(
        "backend.api:app",
        host=host,
        port=port,
        reload=os.environ.get("RELOAD", "1") == "1",
    )
