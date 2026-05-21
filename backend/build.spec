# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

torch_datas, torch_binaries, torch_hidden = collect_all('torch')
torchaudio_datas, torchaudio_binaries, torchaudio_hidden = collect_all('torchaudio')
demucs_datas, demucs_binaries, demucs_hidden = collect_all('demucs')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=torch_binaries + torchaudio_binaries + demucs_binaries,
    datas=(
        torch_datas + torchaudio_datas + demucs_datas
        + collect_data_files('df')
        + collect_data_files('scipy')
    ),
    hiddenimports=(
        torch_hidden + torchaudio_hidden + demucs_hidden
        + collect_submodules('df')
        + collect_submodules('numpy')
        + collect_submodules('scipy')
        + [
            'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
            'uvicorn.protocols', 'uvicorn.protocols.http',
            'uvicorn.protocols.http.auto',
            'uvicorn.protocols.websockets',
            'uvicorn.protocols.websockets.auto',
            'uvicorn.lifespan', 'uvicorn.lifespan.on',
            'multipart', 'python_multipart',
            'einops', 'julius', 'soundfile',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['tkinter', 'matplotlib', 'IPython', 'jupyter', 'notebook'],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
