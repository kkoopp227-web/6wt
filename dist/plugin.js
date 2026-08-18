window.enmity.plugins.registerPlugin({
  name: "FakeVoice",
  version: "5.0.0",
  description: "اضغط طويلاً على أي رسالة واختر ملف صوتي أو فيديو وأرسله كرسالة صوتية",
  color: "#ff0000",

  onStart: function () {
    try {
      const { patcher, modules, React } = window.enmity;
      const UploadActions = modules.getByProps("uploadFiles") || modules.getByProps("upload");

      // ============================
      // دالة فتح منتقي الملفات وإرسال كرسالة صوتية
      // ============================
      function sendFakeVoice(channelId) {
        const ImagePicker = modules.getByProps("launchImageLibraryAsync") ||
          modules.getByProps("launchImageLibrary");
        const DocumentPicker = modules.getByProps("pickSingle") ||
          modules.getByProps("pick") ||
          modules.getByProps("getDocumentAsync");

        function doUpload(uri, filename, mimeType) {
          if (!UploadActions) return;
          const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
          UploadActions[method]({
            channelId: channelId,
            uploads: [{
              filename: filename || "voice.ogg",
              uri: uri,
              mimeType: mimeType || "audio/ogg",
              waveform: "Cg==",
              duration_secs: 10.0,
            }],
            parsedMessage: { content: "", flags: 8192 },
          });
        }

        // محاولة 1: expo-image-picker
        if (ImagePicker && ImagePicker.launchImageLibraryAsync) {
          ImagePicker.launchImageLibraryAsync({
            mediaTypes: "All",
            quality: 1,
          }).then(function (result) {
            if (!result.canceled && result.assets && result.assets[0]) {
              const asset = result.assets[0];
              doUpload(asset.uri, asset.fileName || "voice.mp4", asset.mimeType || asset.type || "audio/mp4");
            }
          }).catch(function (e) { console.log("FakeVoice picker1 err:", e); });
          return;
        }

        // محاولة 2: react-native-image-picker
        if (ImagePicker && ImagePicker.launchImageLibrary) {
          ImagePicker.launchImageLibrary(
            { mediaType: "mixed", quality: 1 },
            function (response) {
              if (!response.didCancel && response.assets && response.assets[0]) {
                const asset = response.assets[0];
                doUpload(asset.uri, asset.fileName || "voice.mp4", asset.type || "audio/mp4");
              }
            }
          );
          return;
        }

        // محاولة 3: document picker
        if (DocumentPicker) {
          const pick = DocumentPicker.pickSingle || DocumentPicker.pick || DocumentPicker.getDocumentAsync;
          Promise.resolve(
            pick({ type: ["audio/*", "video/*", "public.audio", "public.movie"] })
          ).then(function (file) {
            if (!file || file.canceled || file.type === "cancel") return;
            const f = file.assets ? file.assets[0] : file;
            doUpload(f.uri, f.name || "voice.ogg", f.mimeType || f.type || "audio/ogg");
          }).catch(function (e) { console.log("FakeVoice picker3 err:", e); });
        }
      }

      // ============================
      // باتش قائمة الضغط الطويل على الرسالة
      // ============================
      const possibleNames = [
        "MessageContextMenu",
        "MessageLongPressActionSheet",
        "NativeMessageContextMenu",
        "MessageActionSheet",
      ];

      let patched = false;

      for (const name of possibleNames) {
        const Comp = modules.getByDisplayName(name);
        if (!Comp) continue;

        const key = Comp.default
          ? "default"
          : Object.keys(Comp).find(k => typeof Comp[k] === "function");
        if (!key) continue;

        patcher.after("FakeVoice", Comp, key, function (args, res) {
          if (!res) return;

          // استخرج channelId من props
          const props = args[0] || {};
          const channelId = props.channelId ||
            (props.message && props.message.channel_id) ||
            (props.channel && props.channel.id);

          // نبني خيار "إرسال كرسالة صوتية"
          const Row = modules.getByDisplayName("ActionSheetRow") ||
            modules.getByDisplayName("BottomSheetRow") ||
            modules.getByDisplayName("FormRow");

          if (!Row) return;
          const rowKey = Row.default ? "default" : Object.keys(Row).find(k => typeof Row[k] === "function");
          if (!rowKey) return;

          const FakeVoiceItem = React.createElement(
            Row[rowKey] || Row,
            {
              key: "fakeVoiceOption",
              label: "🎙️  إرسال كرسالة صوتية",
              onPress: function () {
                const ActionSheet = modules.getByProps("hideActionSheet");
                if (ActionSheet) ActionSheet.hideActionSheet();
                setTimeout(function () {
                  sendFakeVoice(channelId);
                }, 300);
              }
            }
          );

          // ندخل الزر في القائمة
          function inject(node) {
            if (!node || !node.props) return false;
            if (Array.isArray(node.props.children)) {
              node.props.children.unshift(FakeVoiceItem);
              return true;
            }
            if (node.props.children && node.props.children.props) {
              return inject(node.props.children);
            }
            return false;
          }

          inject(res);
        });

        patched = true;
        break;
      }

      // ============================
      // إذا فشلت كل المحاولات، استخدم باتش عام عبر getByProps
      // ============================
      if (!patched) {
        const ActionSheetUtils = modules.getByProps("openLazy", "hideActionSheet");
        if (ActionSheetUtils) {
          patcher.before("FakeVoice", ActionSheetUtils, "openLazy", function (args) {
            const factory = args[0];
            const key = args[1];
            if (typeof key === "string" && key.toLowerCase().includes("message")) {
              const originalFactory = factory;
              args[0] = new Promise(function (resolve) {
                originalFactory.then(function (mod) {
                  const Comp = mod.default || mod;
                  if (typeof Comp === "function") {
                    patcher.after("FakeVoice", mod, "default", function (innerArgs, res) {
                      if (!res) return;
                      const props = innerArgs[0] || {};
                      const channelId = props.channelId ||
                        (props.message && props.message.channel_id);

                      const Row = modules.getByDisplayName("ActionSheetRow") ||
                        modules.getByDisplayName("BottomSheetRow");
                      if (!Row) return;
                      const rk = Row.default ? "default" : Object.keys(Row).find(k => typeof Row[k] === "function");
                      if (!rk) return;

                      const btn = React.createElement(
                        Row[rk] || Row,
                        {
                          key: "fakeVoiceFallback",
                          label: "🎙️  إرسال كرسالة صوتية",
                          onPress: function () {
                            const AS = modules.getByProps("hideActionSheet");
                            if (AS) AS.hideActionSheet();
                            setTimeout(function () { sendFakeVoice(channelId); }, 300);
                          }
                        }
                      );

                      if (res.props && Array.isArray(res.props.children)) {
                        res.props.children.unshift(btn);
                      }
                    });
                  }
                  resolve(mod);
                });
              });
            }
          });
        }
      }

    } catch (e) {
      console.log("FakeVoice v5 error:", e);
    }
  },

  onStop: function () {
    window.enmity.patcher.unpatchAll("FakeVoice");
  }
});
