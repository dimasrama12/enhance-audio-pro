# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all, collect_data_files, collect_submodules

torch_datas, torch_binaries, torch_hidden = collect_all('torch')
torchaudio_datas, torchaudio_binaries, torchaudio_hidden = collect_all('torchaudio')

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=torch_binaries + torchaudio_binaries,
    datas=(
        torch_datas + torchaudio_datas
        + collect_data_files('df')
        + collect_data_files('scipy')
        # Bundle the static ffmpeg binary shipped with imageio-ffmpeg so the
        # frozen sidecar can run trim/speed/pitch/volume/fade/convert/merge/EQ
        # without a system-wide ffmpeg install (imageio_ffmpeg.get_ffmpeg_exe()).
        + collect_data_files('imageio_ffmpeg')
    ),
    hiddenimports=(
        torch_hidden + torchaudio_hidden
        + collect_submodules('df')
        + collect_submodules('numpy')
        + collect_submodules('scipy')
        + [
            # df submodules
            'df.checkpoint', 'df.config', 'df.deepfilternet', 'df.deepfilternet2',
            'df.deepfilternet3', 'df.deepfilternetmf', 'df.enhance',
            'df.evaluation_utils', 'df.io', 'df.logger', 'df.loss',
            'df.lr', 'df.model', 'df.modules', 'df.multiframe',
            'df.sepm', 'df.stoi', 'df.train', 'df.utils',
            'df.version', 'df.visualization',
            # uvicorn internals
            'uvicorn.logging', 'uvicorn.loops', 'uvicorn.loops.auto',
            'uvicorn.protocols', 'uvicorn.protocols.http',
            'uvicorn.protocols.http.auto',
            'uvicorn.protocols.websockets',
            'uvicorn.protocols.websockets.auto',
            'uvicorn.lifespan', 'uvicorn.lifespan.on',
            'multipart', 'python_multipart',
            'soundfile',
            'imageio_ffmpeg',
        ]
    ),
    hookspath=[],
    hooksconfig={},
    # pyi_rth_torchaudio_compat runs before app code and injects a shim for
    # torchaudio.backend.common.AudioMetaData (removed in torchaudio 2.x but
    # still imported by deepfilternet df/io.py).
    runtime_hooks=['rthooks/pyi_rth_torchaudio_compat.py'],
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
