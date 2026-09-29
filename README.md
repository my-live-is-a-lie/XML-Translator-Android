# XML Translator for Android

تطبيق أندرويد لترجمة ملفات `strings.xml` — استيراد، ترجمة يدوية أو بالذكاء الاصطناعي، وتصدير ملف جاهز لمجلد `values-xx`.

Android app to translate Android `strings.xml` files. Import source XML, edit translations (manual or AI), and export a target `strings.xml`.

This repository is the **Capacitor Android** edition of [strings.xml-Translator](https://github.com/my-live-is-a-lie/strings.xml-Translator). The APK is a standalone app: editing and the offline glossary work without a server. Optional AI providers (Google Translate, MyMemory, DeepL, OpenAI, Gemini, Yandex, Microsoft) run on-device using keys you paste in the app.

## Features

- Import `strings.xml` (`<string>`, `<plurals>`, `<string-array>`)
- Merge an existing target translation file
- CLDR plural forms (Arabic uses all 6)
- Preserve Android placeholders (`%1$s`, `%d`, `\n`, HTML tags)
- Editor + table views, undo/redo, keyboard shortcuts
- Auto-save locally
- Native Android share/save for the exported XML
- Hardware back button closes dialogs, then exits
- GitHub Actions builds a debug APK on every push to `main`

## Download APK

1. Open the [Actions](../../actions) tab after a successful run of **Build Android APK**.
2. Download the `xml-translator-debug-apk` artifact.

Or build locally (see below).

## Build the Android app

Requirements:

- Node.js 22+
- JDK 21
- Android Studio (SDK + platform tools)

```bash
git clone https://github.com/my-live-is-a-lie/XML-Translator-Android.git
cd XML-Translator-Android
npm install
npm run android:sync
npm run android:open
```

In Android Studio: **Run** on an emulator or device, or **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

CLI (with a device/emulator attached):

```bash
npm run android:run
```

The debug APK is written to:

`android/app/build/outputs/apk/debug/app-debug.apk`

## Web (optional)

The same UI still runs in a browser:

```bash
npm install
npm run dev
```

Server-side Gemini (`GEMINI_API_KEY`) is only used in this web/server mode. The APK does not embed that secret.

To point the APK at a hosted backend, set `VITE_BACKEND_URL` before `npm run build`.

## App identity

| | |
|---|---|
| App name | XML Translator |
| Application ID | `com.translator.androidstrings` |
| Min / target | Android 7+ (Capacitor 8 defaults) |

## License

Source derived from the original translator project. Use and modify freely.
