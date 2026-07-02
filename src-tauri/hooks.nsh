!macro NSIS_HOOK_POSTINSTALL
  CopyFiles "$INSTDIR\resources\WebView2Loader.dll" "$INSTDIR\WebView2Loader.dll"
!macroend
