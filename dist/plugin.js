window.enmity.plugins.registerPlugin({
  name: "FakeVoice",
  version: "3.0.0",
  description: "زر فوق المايك يرسل الفيديو والصوت كرسائل صوتية",
  color: "#ff0000",

  onStart: function () {
    try {
      const { patcher, modules, React } = window.enmity;

      // ============================
      // باتش رفع الملفات - يضيف flag الرسالة الصوتية
      // ============================
      const UploadActions = modules.getByProps("uploadFiles") || modules.getByProps("upload");

      function patchUpload(options) {
        if (!options || !options.uploads) return;
        options.uploads.forEach(function (u) {
          u.waveform = "Cg==";
          u.duration_secs = 10.0;
          if (options.parsedMessage) {
            options.parsedMessage.flags = 8192;
          }
        });
      }

      if (UploadActions) {
        const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
        patcher.before("FakeVoice", UploadActions, method, function (args) {
          const options = args[0];
          if (options && options.__fakeVoice) {
            patchUpload(options);
          }
        });
      }

      // ============================
      // باتش خانة الكتابة - نضيف زرنا بجوار زر التسجيل (المايك)
      // ============================
      // نبحث عن المكون الذي يحتوي على زر التسجيل الصوتي
      const ChatInputTypes = [
        "ChatInput",
        "ChannelTextAreaContainer",
        "ChatInputBar",
        "VoiceMessageButton",
        "ApplicationCommandInput"
      ];

      let patched = false;

      for (const name of ChatInputTypes) {
        const Comp = modules.getByDisplayName(name);
        if (!Comp) continue;

        const key = Comp.default ? "default" : Object.keys(Comp).find(k => typeof Comp[k] === "function");
        if (!key) continue;

        patcher.after("FakeVoice", Comp, key, function (args, res) {
          if (!res) return;

          // ابحث عن زر المايك بعمق داخل شجرة المكونات
          function findAndInject(node) {
            if (!node || typeof node !== "object") return false;

            const props = node.props;
            if (!props) return false;

            // نبحث عن أي مكون يحتوي على "record" أو "voice" أو "mic" في خصائصه
            const str = JSON.stringify(props).toLowerCase();
            if (
              str.includes("voice_message") ||
              str.includes("recordvoice") ||
              str.includes("startrecording") ||
              str.includes("holdtorecord")
            ) {
              // وجدنا الحاوية، نضيف زرنا فوقه
              const parent = node;
              if (Array.isArray(parent.props.children)) {
                parent.props.children.unshift(
                  React.createElement(
                    "TouchableOpacity",
                    {
                      key: "fakeVoiceBtn",
                      onPress: function () {
                        openFilePicker();
                      },
                      style: {
                        width: 36,
                        height: 36,
                        borderRadius: 18,
                        backgroundColor: "#ff4444",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 6,
                      }
                    },
                    React.createElement(
                      "Text",
                      { style: { color: "#fff", fontSize: 18 } },
                      "🎙"
                    )
                  )
                );
                return true;
              }
            }

            const children = props.children;
            if (!children) return false;

            if (Array.isArray(children)) {
              for (const child of children) {
                if (findAndInject(child)) return true;
              }
            } else {
              return findAndInject(children);
            }

            return false;
          }

          findAndInject(res);
        });

        patched = true;
        break;
      }

      // ============================
      // إذا فشل الباتش المباشر، نستخدم طريقة احتياطية
      // ============================
      if (!patched) {
        const FluxComponents = modules.getByProps("connectStores");
        if (FluxComponents) {
          // محاولة باتش بديلة عبر الشاشة الكاملة
          const ChannelView = modules.getByDisplayName("ChannelView") || modules.getByDisplayName("Chat");
          if (ChannelView) {
            const key = ChannelView.default ? "default" : Object.keys(ChannelView).find(k => typeof ChannelView[k] === "function");
            if (key) {
              patcher.after("FakeVoice", ChannelView, key, function (args, res) {
                if (!res) return;
                // نضيف الزر بطريقة مختلفة
                injectButton(res);
              });
            }
          }
        }
      }

      // دالة فتح منتقي الملفات
      function openFilePicker() {
        const DocumentPicker = modules.getByProps("pickSingle") || modules.getByProps("pick");
        const ImagePicker = modules.getByProps("launchImageLibrary");

        if (ImagePicker) {
          ImagePicker.launchImageLibrary(
            { mediaType: "mixed", quality: 1 },
            function (response) {
              if (!response || response.didCancel || !response.assets) return;
              const asset = response.assets[0];
              if (!asset) return;

              if (UploadActions) {
                const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
                UploadActions[method]({
                  uploads: [{
                    filename: asset.fileName || "audio.mp4",
                    uri: asset.uri,
                    mimeType: asset.type || "audio/mp4",
                    waveform: "Cg==",
                    duration_secs: 10.0,
                  }],
                  __fakeVoice: true,
                });
              }
            }
          );
        } else if (DocumentPicker) {
          const pick = DocumentPicker.pickSingle || DocumentPicker.pick;
          pick({ type: ["audio/*", "video/*"] }).then(function (file) {
            if (!file) return;
            if (UploadActions) {
              const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
              UploadActions[method]({
                uploads: [{
                  filename: file.name || "audio.ogg",
                  uri: file.uri,
                  mimeType: file.type || "audio/ogg",
                  waveform: "Cg==",
                  duration_secs: 10.0,
                }],
                __fakeVoice: true,
              });
            }
          }).catch(function (e) {
            console.log("FakeVoice picker error:", e);
          });
        }
      }

    } catch (e) {
      console.log("FakeVoice v3 error:", e);
    }
  },

  onStop: function () {
    window.enmity.patcher.unpatchAll("FakeVoice");
  },

  getSettingsPanel: function ({ settings }) {
    const { React, modules } = window.enmity;
    const FormComponents = modules.getByProps("FormSection", "FormSwitch");

    if (!FormComponents) return null;
    const { FormSection, FormSwitch } = FormComponents;

    return React.createElement(
      FormSection,
      { title: "خيارات FakeVoice" },
      React.createElement(FormSwitch, {
        label: "وضع التلقائي",
        subLabel: "يحول كل ملف صوتي/فيديو ترسله تلقائياً إلى رسالة صوتية",
        value: settings.getBoolean("autoMode", false),
        onValueChange: function (v) { settings.set("autoMode", v); }
      })
    );
  }
});
