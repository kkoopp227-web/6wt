window.enmity.plugins.registerPlugin({
  name: "FakeVoice",
  version: "2.0.0",
  description: "أرسل الفيديو والصوت كرسائل صوتية عبر زر خاص في قائمة المرفقات",
  color: "#ff0000",

  onStart: function () {
    try {
      const { patcher, modules, React } = window.enmity;

      // ============================
      // 1) مفتاح التلقائي - يحول كل ملف صوتي/فيديو تلقائياً
      // ============================
      const autoEnabled = () => window.enmity.settings.get("FakeVoice", "autoMode", false);

      const UploadActions = modules.getByProps("uploadFiles") || modules.getByProps("upload");
      if (UploadActions) {
        const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
        patcher.before("FakeVoice", UploadActions, method, function (args) {
          const options = args[0];
          if (!options) return;

          const shouldConvert = autoEnabled() || (options.__fakeVoice === true);

          if (shouldConvert && options.uploads && options.uploads.length > 0) {
            options.uploads.forEach(function (u) {
              const isMedia =
                u.filename && (
                  u.filename.match(/\.(mp3|ogg|m4a|wav|flac|mp4|mov|mkv|webm)$/i) ||
                  (u.mimeType && (u.mimeType.startsWith("audio/") || u.mimeType.startsWith("video/")))
                );

              if (isMedia) {
                u.waveform = "Cg==";
                u.duration_secs = 10.0;
                if (options.parsedMessage) {
                  options.parsedMessage.flags = 8192;
                }
              }
            });
          }
        });
      }

      // ============================
      // 2) إضافة زر جديد في قائمة (+) المرفقات
      // ============================
      const ActionSheet = modules.getByProps("openLazy") || modules.getByProps("openActionSheet");
      const ChannelActions = modules.getByProps("sendMessage");

      // نبحث عن قائمة المرفقات لنضيف زرنا فيها
      const AttachMenu = modules.getByDisplayName("MediaPickerContextMenu") ||
        modules.getByDisplayName("AttachmentMenu") ||
        modules.getByProps("renderMediaPickerButton");

      if (AttachMenu) {
        const targetKey = AttachMenu.default ? "default" : Object.keys(AttachMenu).find(k => typeof AttachMenu[k] === "function");
        if (targetKey) {
          patcher.after("FakeVoice", AttachMenu, targetKey, function (args, res) {
            if (!res || !res.props || !res.props.children) return;

            const FakeVoiceButton = React.createElement(
              modules.getByDisplayName("TouchableOpacity") || "TouchableOpacity",
              {
                key: "fakeVoiceBtn",
                onPress: function () {
                  // نفتح منتقي الملفات ونضع علامة FakeVoice
                  const DocumentPicker = modules.getByProps("pickMultiple") || modules.getByProps("getDocumentAsync");
                  if (DocumentPicker) {
                    const picker = DocumentPicker.pickMultiple || DocumentPicker.getDocumentAsync;
                    picker({ type: ["audio/*", "video/*"] }).then(function (files) {
                      if (!files || files.length === 0) return;
                      if (UploadActions) {
                        const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
                        UploadActions[method]({
                          uploads: files,
                          __fakeVoice: true,
                        });
                      }
                    });
                  }
                },
                style: { padding: 8 }
              },
              React.createElement(
                modules.getByDisplayName("Text") || "Text",
                { style: { color: "#fff", fontSize: 13, textAlign: "center" } },
                "🎙️\nصوت وهمي"
              )
            );

            if (Array.isArray(res.props.children)) {
              res.props.children.unshift(FakeVoiceButton);
            }
          });
        }
      }

    } catch (e) {
      console.log("FakeVoice v2 error:", e);
    }
  },

  onStop: function () {
    window.enmity.patcher.unpatchAll("FakeVoice");
  },

  // ============================
  // 3) صفحة الإعدادات (المفتاح التلقائي)
  // ============================
  getSettingsPanel: function ({ settings }) {
    const { React, modules } = window.enmity;
    const { FormSection, FormSwitch } = modules.getByProps("FormSection") || {};

    if (!FormSection || !FormSwitch) return null;

    return React.createElement(
      FormSection,
      { title: "خيارات FakeVoice" },
      React.createElement(FormSwitch, {
        label: "وضع التلقائي",
        subLabel: "يحول كل ملف صوتي/فيديو ترسله تلقائياً إلى رسالة صوتية (بدون أي أوامر)",
        value: settings.getBoolean("autoMode", false),
        onValueChange: function (v) { settings.set("autoMode", v); }
      })
    );
  }
});
