window.enmity.plugins.registerPlugin({
  name: "FakeVoice",
  version: "4.0.0",
  description: "اضغط طويلاً على رسالة تحتوي صوت أو فيديو لإرسالها كرسالة صوتية",
  color: "#ff0000",

  onStart: function () {
    try {
      const { patcher, modules, React } = window.enmity;

      // ============================
      // باتش رفع الملفات - يضيف flag الرسالة الصوتية
      // ============================
      const UploadActions = modules.getByProps("uploadFiles") || modules.getByProps("upload");

      if (UploadActions) {
        const method = UploadActions.uploadFiles ? "uploadFiles" : "upload";
        patcher.before("FakeVoice", UploadActions, method, function (args) {
          const options = args[0];
          if (options && options.__fakeVoice) {
            if (options.uploads) {
              options.uploads.forEach(function (u) {
                u.waveform = "Cg==";
                u.duration_secs = 10.0;
              });
            }
            if (options.parsedMessage) {
              options.parsedMessage.flags = 8192;
            }
          }
        });
      }

      // ============================
      // باتش قائمة الضغط الطويل على الرسالة
      // ============================
      const MessageContextMenu = modules.getByDisplayName("MessageContextMenu") ||
        modules.getByDisplayName("MessageLongPressActionSheet") ||
        modules.getByDisplayName("NativeMessageContextMenu");

      if (MessageContextMenu) {
        const key = MessageContextMenu.default
          ? "default"
          : Object.keys(MessageContextMenu).find(k => typeof MessageContextMenu[k] === "function");

        if (key) {
          patcher.after("FakeVoice", MessageContextMenu, key, function (args, res) {
            if (!res) return;

            const message = args[0] && (args[0].message || args[0]);
            if (!message) return;

            // نتأكد أن الرسالة تحتوي على مرفقات صوتية أو فيديوهات
            const attachments = message.attachments || [];
            const hasMedia = attachments.some(function (a) {
              return a.content_type && (
                a.content_type.startsWith("audio/") ||
                a.content_type.startsWith("video/")
              );
            });

            if (!hasMedia) return;

            // نبني الزر الجديد بنفس شكل الأزرار الموجودة
            const { ButtonRow, Button } = modules.getByProps("ButtonRow") ||
              modules.getByProps("FormRow") || {};

            const ActionSheetRow = modules.getByDisplayName("BottomSheetRow") ||
              modules.getByDisplayName("ActionSheetRow");

            if (!ActionSheetRow && !ButtonRow) return;

            const FakeVoiceItem = React.createElement(
              ActionSheetRow || ButtonRow,
              {
                key: "fakeVoiceOption",
                label: "🎙️ إرسال كرسالة صوتية",
                icon: React.createElement(
                  modules.getByDisplayName("Text") || "Text",
                  { style: { fontSize: 20 } },
                  "🎙️"
                ),
                onPress: function () {
                  // إغلاق القائمة
                  const ActionSheet = modules.getByProps("hideActionSheet");
                  if (ActionSheet) ActionSheet.hideActionSheet();

                  // إرسال كل المرفقات الصوتية/المرئية كرسائل صوتية
                  const ChannelActions = modules.getByProps("sendMessage");
                  if (ChannelActions && attachments.length > 0) {
                    attachments.forEach(function (attachment) {
                      if (
                        attachment.content_type &&
                        (attachment.content_type.startsWith("audio/") ||
                          attachment.content_type.startsWith("video/"))
                      ) {
                        if (UploadActions) {
                          const uploadMethod = UploadActions.uploadFiles ? "uploadFiles" : "upload";
                          UploadActions[uploadMethod]({
                            channelId: message.channel_id,
                            uploads: [{
                              filename: attachment.filename || "audio.ogg",
                              uri: attachment.url,
                              mimeType: attachment.content_type,
                              waveform: "Cg==",
                              duration_secs: attachment.duration_secs || 10.0,
                            }],
                            parsedMessage: { content: "", flags: 8192 },
                            __fakeVoice: true,
                          });
                        } else if (ChannelActions.sendMessage) {
                          // بديل: نرسل رسالة بـ flag صوتي
                          ChannelActions.sendMessage(
                            message.channel_id,
                            {
                              content: "",
                              flags: 8192,
                              attachments: [{
                                id: 0,
                                filename: attachment.filename || "audio.ogg",
                                uploaded_filename: attachment.filename,
                                waveform: "Cg==",
                                duration_secs: 10.0,
                              }]
                            }
                          );
                        }
                      }
                    });
                  }
                }
              }
            );

            // نضيف الزر في بداية القائمة (فوق خيار الرد)
            if (res.props && res.props.children) {
              if (Array.isArray(res.props.children)) {
                res.props.children.unshift(FakeVoiceItem);
              } else if (res.props.children.props && Array.isArray(res.props.children.props.children)) {
                res.props.children.props.children.unshift(FakeVoiceItem);
              }
            }
          });
        }
      }

    } catch (e) {
      console.log("FakeVoice v4 error:", e);
    }
  },

  onStop: function () {
    window.enmity.patcher.unpatchAll("FakeVoice");
  }
});
