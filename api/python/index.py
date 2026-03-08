from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import sys
import io
import base64
import json
import traceback
import contextlib
from typing import Any, Optional

app = FastAPI()


class ExecuteRequest(BaseModel):
    code: str
    timeout: int = 30
    variables: Optional[dict[str, Any]] = None


class ImageOutput(BaseModel):
    name: str
    data: str  # base64 encoded
    mime_type: str


class ExecuteResponse(BaseModel):
    success: bool
    stdout: Optional[str] = None
    stderr: Optional[str] = None
    result: Optional[str] = None  # JSON-serialized return value
    images: Optional[list[ImageOutput]] = None
    error: Optional[str] = None
    error_type: Optional[str] = None


def capture_matplotlib_figures() -> list[ImageOutput]:
    """Capture any open matplotlib figures as base64 PNG images."""
    images = []
    try:
        import matplotlib.pyplot as plt
        
        for fig_num in plt.get_fignums():
            fig = plt.figure(fig_num)
            buf = io.BytesIO()
            fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
            buf.seek(0)
            images.append(ImageOutput(
                name=f'figure_{fig_num}.png',
                data=base64.b64encode(buf.read()).decode('utf-8'),
                mime_type='image/png'
            ))
            plt.close(fig)
    except ImportError:
        pass  # matplotlib not available
    except Exception:
        pass  # Ignore errors in figure capture
    
    return images


def safe_serialize(obj: Any) -> Optional[str]:
    """Safely serialize an object to JSON string."""
    if obj is None:
        return None
    
    try:
        # Try direct JSON serialization first
        return json.dumps(obj)
    except (TypeError, ValueError):
        pass
    
    # Handle common types
    try:
        # numpy arrays
        if hasattr(obj, 'tolist'):
            return json.dumps(obj.tolist())
        
        # pandas DataFrames/Series
        if hasattr(obj, 'to_dict'):
            return json.dumps(obj.to_dict())
        
        # Fallback to string representation
        return json.dumps(str(obj))
    except Exception:
        return json.dumps(str(obj))


def execute_code(code: str, variables: Optional[dict[str, Any]] = None) -> tuple[str, str, Any, list[ImageOutput], Optional[str], Optional[str]]:
    """
    Execute Python code and capture outputs.
    
    Returns: (stdout, stderr, result, images, error, error_type)
    """
    stdout_capture = io.StringIO()
    stderr_capture = io.StringIO()
    result = None
    error = None
    error_type = None
    images = []
    
    # Create execution namespace with common imports pre-loaded
    namespace = {
        '__builtins__': __builtins__,
        '__name__': '__main__',
    }
    
    # Pre-import common packages into namespace
    try:
        import numpy as np
        namespace['np'] = np
        namespace['numpy'] = np
    except ImportError:
        pass
    
    try:
        import matplotlib
        matplotlib.use('Agg')  # Non-interactive backend
        import matplotlib.pyplot as plt
        namespace['plt'] = plt
        namespace['matplotlib'] = matplotlib
    except ImportError:
        pass
    
    try:
        import math
        namespace['math'] = math
    except ImportError:
        pass
    
    try:
        import json as json_module
        namespace['json'] = json_module
    except ImportError:
        pass
    
    try:
        import datetime
        namespace['datetime'] = datetime
    except ImportError:
        pass
    
    try:
        import re
        namespace['re'] = re
    except ImportError:
        pass
    
    try:
        import random
        namespace['random'] = random
    except ImportError:
        pass
    
    try:
        import statistics
        namespace['statistics'] = statistics
    except ImportError:
        pass
    
    # Inject user-provided variables
    if variables:
        namespace.update(variables)
    
    # Redirect stdout and stderr
    with contextlib.redirect_stdout(stdout_capture), contextlib.redirect_stderr(stderr_capture):
        try:
            # Compile the code
            compiled = compile(code, '<user_code>', 'exec')
            
            # Execute the code
            exec(compiled, namespace)
            
            # Check for a 'result' variable in namespace
            if 'result' in namespace and namespace['result'] is not namespace.get('__builtins__', {}).get('result'):
                result = namespace['result']
            # Also check for '_' which is common for last expression
            elif '_' in namespace:
                result = namespace['_']
            
        except SyntaxError as e:
            error = f"SyntaxError: {e.msg} (line {e.lineno})"
            error_type = "SyntaxError"
        except Exception as e:
            error = traceback.format_exc()
            error_type = type(e).__name__
    
    # Capture matplotlib figures
    images = capture_matplotlib_figures()
    
    return (
        stdout_capture.getvalue(),
        stderr_capture.getvalue(),
        result,
        images,
        error,
        error_type
    )


@app.post("/api/python")
async def execute_python(request: ExecuteRequest) -> ExecuteResponse:
    """Execute Python code and return results."""
    
    if not request.code or not request.code.strip():
        raise HTTPException(status_code=400, detail="No code provided")
    
    # Execute the code
    stdout, stderr, result, images, error, error_type = execute_code(
        request.code,
        request.variables
    )
    
    # Serialize the result
    result_json = safe_serialize(result) if result is not None else None
    
    return ExecuteResponse(
        success=error is None,
        stdout=stdout if stdout else None,
        stderr=stderr if stderr else None,
        result=result_json,
        images=images if images else None,
        error=error,
        error_type=error_type
    )


@app.get("/api/python")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "runtime": "python",
        "packages": ["numpy", "matplotlib", "math", "json", "datetime", "re", "random", "statistics"]
    }


# Error handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": str(exc),
            "error_type": type(exc).__name__
        }
    )
