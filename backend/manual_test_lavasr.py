import os
import sys

# Ensure backend root is in Python path so processors module can be resolved
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from processors.enhance_lavasr import enhance_file_lavasr

def progress(pct):
    print(f"Progress: {pct}%")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python manual_test_lavasr.py <input> <output>")
        sys.exit(1)
        
    enhance_file_lavasr(sys.argv[1], sys.argv[2], progress)
    print("Done")
