#!/usr/bin/env python3
"""Fetch all marketable item listings from Universalis API.

Usage:
    python scripts/fetch_listings.py

This script fetches the current listings for all marketable items
in the China region, batching 100 items per request (API limit).
Results are saved to `data/listings/batch_###.json`.
"""

import json
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

import requests

# ------------------------------------------------------------------
# Configuration
# ------------------------------------------------------------------

REGION = "中国"
BATCH_SIZE = 100
MAX_WORKERS = 3
RETRY_COUNT = 3
DELAY_BETWEEN_BATCHES = 0.2  # seconds
TIMEOUT = 30

MARKETABLE_IDS_FILE = Path("marketable_ids.json")
OUTPUT_DIR = Path("data/listings")

# ------------------------------------------------------------------


def fetch_batch(batch_num: int, item_ids: list[int]) -> tuple[int, int, bool, str | None]:
    """Fetch one batch of item listings.

    Returns: (batch_num, item_count, success, error_message)
    """
    ids_str = ",".join(map(str, item_ids))
    url = f"https://universalis.app/api/v2/{REGION}/{ids_str}?entries=0"
    output_file = OUTPUT_DIR / f"batch_{batch_num:03d}.json"

    for attempt in range(RETRY_COUNT):
        try:
            response = requests.get(url, timeout=TIMEOUT)
            response.raise_for_status()
            data = response.json()

            with open(output_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, separators=(",", ":"))

            return batch_num, len(item_ids), True, None
        except Exception as e:
            if attempt < RETRY_COUNT - 1:
                time.sleep(2 ** attempt)  # exponential backoff
            else:
                return batch_num, len(item_ids), False, str(e)

    return batch_num, len(item_ids), False, "unreachable"


def main() -> None:
    # ------------------------------------------------------------------
    # Load item IDs
    # ------------------------------------------------------------------
    if not MARKETABLE_IDS_FILE.exists():
        print(f"Error: {MARKETABLE_IDS_FILE} not found.")
        print("Run: curl -sL 'https://universalis.app/api/v2/marketable' > marketable_ids.json")
        return

    with open(MARKETABLE_IDS_FILE, encoding="utf-8") as f:
        item_ids: list[int] = json.load(f)

    # ------------------------------------------------------------------
    # Prepare batches
    # ------------------------------------------------------------------
    batches = [
        item_ids[i : i + BATCH_SIZE]
        for i in range(0, len(item_ids), BATCH_SIZE)
    ]

    print(f"Total items:   {len(item_ids):,}")
    print(f"Batch size:    {BATCH_SIZE}")
    print(f"Total batches: {len(batches)}")
    print(f"Workers:       {MAX_WORKERS}")
    print(f"Output dir:    {OUTPUT_DIR}")
    print()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Fetch with limited concurrency
    # ------------------------------------------------------------------
    start_time = time.time()
    completed = 0
    failed_batches: list[int] = []

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {
            executor.submit(fetch_batch, i, batch): i
            for i, batch in enumerate(batches)
        }

        for future in as_completed(futures):
            batch_num, count, success, error = future.result()
            completed += 1

            if success:
                print(
                    f"[{completed:>3}/{len(batches):>3}] batch_{batch_num:03d}  "
                    f"OK  ({count} items)"
                )
            else:
                print(
                    f"[{completed:>3}/{len(batches):>3}] batch_{batch_num:03d}  "
                    f"FAIL  ({count} items)  {error}"
                )
                failed_batches.append(batch_num)

            time.sleep(DELAY_BETWEEN_BATCHES)

    elapsed = time.time() - start_time
    print()
    print(f"Completed in {elapsed:.1f}s")
    print(f"Success: {len(batches) - len(failed_batches)}/{len(batches)}")

    if failed_batches:
        print(f"Failed batches: {failed_batches}")
        print("\nTo retry failed batches, run this script again.")
        print("(Already-downloaded batches will be skipped if you modify the script.)")

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    total_bytes = sum(f.stat().st_size for f in OUTPUT_DIR.glob("batch_*.json"))
    print(f"Total data size: {total_bytes / 1024 / 1024:.2f} MB")


if __name__ == "__main__":
    main()
