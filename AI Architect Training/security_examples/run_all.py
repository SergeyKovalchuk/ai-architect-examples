"""Run all four demos (vulnerable + mitigated for both risks). No dependencies.

Usage:  python run_all.py
"""
import subprocess, sys, os

HERE = os.path.dirname(os.path.abspath(__file__))
DEMOS = [
    ("RISK 1 — LLM01 Prompt Injection — VULNERABLE", "risk1_prompt_injection/vulnerable.py"),
    ("RISK 1 — LLM01 Prompt Injection — MITIGATED", "risk1_prompt_injection/mitigated.py"),
    ("RISK 2 — LLM06 Excessive Agency — VULNERABLE", "risk2_excessive_agency/vulnerable.py"),
    ("RISK 2 — LLM06 Excessive Agency — MITIGATED", "risk2_excessive_agency/mitigated.py"),
]

for title, path in DEMOS:
    print("\n" + "#" * 72 + f"\n# {title}\n" + "#" * 72)
    subprocess.run([sys.executable, os.path.join(HERE, path)], check=True)
