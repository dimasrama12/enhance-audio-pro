from routers.video import _normalize_input_path


def test_strips_verbatim_prefix():
    assert (
        _normalize_input_path("\\\\?\\D:\\videos\\[Kusonime] clip [1080p].mkv")
        == "D:\\videos\\[Kusonime] clip [1080p].mkv"
    )


def test_strips_verbatim_unc_prefix():
    assert (
        _normalize_input_path("\\\\?\\UNC\\server\\share\\clip.mp4")
        == "\\\\server\\share\\clip.mp4"
    )


def test_trims_whitespace_and_quotes():
    assert _normalize_input_path('  "D:\\a\\b.mkv"  ') == "D:\\a\\b.mkv"


def test_plain_path_unchanged():
    p = "D:\\videos\\clip.mov"
    assert _normalize_input_path(p) == p
