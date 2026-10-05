from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from time import perf_counter
import json
import platform
import statistics

from fastapi.testclient import TestClient
from app.config import Settings
from app.main import create_app

with TemporaryDirectory(prefix='traders-edge-benchmark-') as directory:
    settings = Settings(database_url=f'sqlite+aiosqlite:///{Path(directory) / "benchmark.db"}')
    app = create_app(settings)
    with TestClient(app, headers={'Origin': 'http://localhost:5173'}) as client:
        identities = []
        for _ in range(20):
            client.cookies.clear()
            response = client.post('/api/session')
            response.raise_for_status()
            identities.append(f'{settings.cookie_name}={client.cookies.get(settings.cookie_name)}')
        client.cookies.clear()
        results = []
        for path in ('/api/me/profile', '/api/curriculum', '/api/me/workflow'):
            for _ in range(5):
                client.get(path, headers={'Cookie': identities[0]}).raise_for_status()

            def request(index):
                start = perf_counter()
                response = client.get(path, headers={'Cookie': identities[index % len(identities)]})
                return (perf_counter() - start) * 1000, response.status_code, len(response.content)

            with ThreadPoolExecutor(max_workers=20) as executor:
                samples = list(executor.map(request, range(200)))
            values = sorted(sample[0] for sample in samples)
            results.append({
                'path': path,
                'requests': len(samples),
                'median_ms': round(statistics.median(values), 2),
                'p95_ms': round(values[189], 2),
                'max_ms': round(max(values), 2),
                'statuses': sorted({sample[1] for sample in samples}),
                'max_response_bytes': max(sample[2] for sample in samples),
            })
        print(json.dumps({
            'scope': 'In-process FastAPI TestClient with temporary SQLite and 20 fresh guest profiles; excludes network, Firebase, PostgreSQL and populated-history load',
            'machine': platform.machine(),
            'python': platform.python_version(),
            'concurrency': 20,
            'results': results,
        }, indent=2))
        if any(result['statuses'] != [200] for result in results):
            raise SystemExit(1)
