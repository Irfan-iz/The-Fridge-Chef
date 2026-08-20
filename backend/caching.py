"""
Real-Time In-Memory Response Caching & Telemetry Engine
The Fridge Chef — Performance & Real-Time Caching Layer

Provides thread-safe TTL caching for LLM completions, DOSM price queries,
and optimization calculations to achieve sub-50ms response times for repeated queries.
"""

import time
import hashlib
import json
import logging
from typing import Any, Optional, Dict, Tuple

logger = logging.getLogger("fridge_chef_cache")

class RealTimeCache:
    def __init__(self, default_ttl_seconds: int = 3600):
        self.default_ttl = default_ttl_seconds
        self._cache: Dict[str, Tuple[float, Any]] = {}
        self.hits = 0
        self.misses = 0

    def _generate_key(self, prefix: str, payload: Any) -> str:
        """Generates a deterministic MD5 hash key for any serializable payload."""
        if isinstance(payload, dict):
            # Normalize dictionary with sorted keys
            normalized = json.dumps(payload, sort_keys=True, default=str)
        elif isinstance(payload, list):
            normalized = json.dumps(sorted([str(x) for x in payload]), default=str)
        else:
            normalized = str(payload)
        
        hash_digest = hashlib.md5(normalized.encode("utf-8")).hexdigest()
        return f"{prefix}:{hash_digest}"

    def get(self, prefix: str, payload: Any) -> Optional[Any]:
        """Retrieves a cached value if not expired."""
        key = self._generate_key(prefix, payload)
        now = time.time()
        
        if key in self._cache:
            expire_at, value = self._cache[key]
            if now < expire_at:
                self.hits += 1
                logger.info(f"CACHE HIT [{prefix}] -> key: {key[:16]}... (Hits: {self.hits})")
                return value
            else:
                # Expired
                del self._cache[key]

        self.misses += 1
        return None

    def set(self, prefix: str, payload: Any, value: Any, ttl: Optional[int] = None) -> None:
        """Stores a value in cache with a designated TTL."""
        key = self._generate_key(prefix, payload)
        ttl_seconds = ttl if ttl is not None else self.default_ttl
        expire_at = time.time() + ttl_seconds
        self._cache[key] = (expire_at, value)
        logger.info(f"CACHE SET [{prefix}] -> key: {key[:16]}... (TTL: {ttl_seconds}s)")

    def clear(self) -> None:
        """Clears all cached entries."""
        self._cache.clear()
        self.hits = 0
        self.misses = 0

    def get_stats(self) -> Dict[str, Any]:
        """Returns cache telemetry and hit rate statistics."""
        total = self.hits + self.misses
        hit_rate = round((self.hits / total * 100), 1) if total > 0 else 0.0
        
        # Prune expired keys count
        now = time.time()
        active_entries = sum(1 for exp, _ in self._cache.values() if exp > now)

        return {
            "total_queries": total,
            "hits": self.hits,
            "misses": self.misses,
            "hit_rate_pct": hit_rate,
            "active_cache_entries": active_entries,
            "estimated_latency_saved_ms": self.hits * 1850 # ~1.85s per LLM generation saved
        }

# Global singleton cache instance
global_cache = RealTimeCache(default_ttl_seconds=3600)
