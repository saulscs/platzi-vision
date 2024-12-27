const express = require("express");
const { OpenAI } = require("openai");

const router = express.Router();
const openai = new OpenAI();

async function generateImage(prompt, quality = "standard") {
  try {
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      quality: quality,
      n: 1,
    });

    console.log("Imagen generada correctamente");
    console.log(response.data[0].url);
    return response.data[0].url;
  } catch (error) {
    console.error("Error al generar la imagen:", error.message);
    throw error;
  }
}

router.post("/", (req, res) => {
  try {
    const { messages } = req.body;

    const formattedMessages = [
      {
        role: "system",
        content:
          "Eres un asistente llamado PlatziVision. Responde a las preguntas de los usuarios sobre Platzi con claridad. Puedes generar imágenes en DALL-E 3. También puedes analizar imágenes que el usuario te envía.",
      },
    ];

    messages.forEach(message => {
      if (message.image_data) {
        const contentParts = [
          {
            type: "text",
            text: message.content,
          },
        ];

        message.image_data.forEach(imageDataBase64 => {
          contentParts.push({
            type: "image_url",
            image_url: {
              url: `data:image/png;base64,${imageDataBase64}`,
            },
          });
        });

        formattedMessages.push({
          role: message.role,
          content: contentParts,
        });
      } else {
        formattedMessages.push({
          role: message.role,
          content: message.content,
        });
      }
    });

    const tools = [
      {
        type: "function",
        function: {
          name: "generateImage",
          description: "Cuando el usuario lo solicite generar una imagen",
          parameters: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "El prompt que se usará para generar la imagen",
              },
              quality: {
                type: "string",
                description:
                  "La calidad de la imagen puede ser 'hd' o 'standard'",
              },
            },
          },
        },
      },
    ];

    let accumulatedArgs = "";
    let response = null;
    let currentToolCallId = null;

    async function generate() {
      try {
        if (!response) {
          response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: formattedMessages,
            stream: true,
            tools: tools,
          });
        }
        console.log("RESPONSE:", response);

        for await (const chunk of response) {
          console.log("Chunk INICIAL:", chunk.choices[0].delta);
          if (chunk.choices[0].delta.content) {
            res.write(
              `data: ${JSON.stringify({
                content: chunk.choices[0]?.delta?.content,
                status: "streaming",
              })}\n\n`
            );
          }

          if (chunk.choices[0]?.finish_reason === "stop") {
            console.log("Chunk de STOP:", chunk);
            res.write(`data: ${JSON.stringify({ status: "done" })}\n\n`);
            res.end();
            break;
          }

          if (chunk.choices[0].delta.tool_calls) {
            console.log("CHUNK", chunk.choices[0].delta.tool_calls);
            const toolCalls = chunk.choices[0].delta.tool_calls;
            if (toolCalls.id && toolCalls.function.name) {
              currentToolCallId = toolCalls.id;
            }
            console.log("Tool calls:", toolCalls);
            if (toolCalls[0].function.arguments) {
              accumulatedArgs += toolCalls[0].function.arguments;
              console.log("Argumentos acumulados:", accumulatedArgs);
              if (accumulatedArgs.trim().endsWith("}")) {
                try {
                  const functionArgs = JSON.parse(accumulatedArgs);

                  if (functionArgs.prompt) {
                    res.write(
                      `data: ${JSON.stringify({
                        status: "generating_image",
                      })}\n\n`
                    );

                    const imageUrl = await generateImage(
                      functionArgs.prompt,
                      functionArgs.quality
                    );

                    formattedMessages.push({
                      role: "assistant",
                      content: null,
                      tool_calls: [
                        {
                          id: currentToolCallId,
                          function: {
                            name: "generateImage",
                            arguments: accumulatedArgs,
                          },
                          type: "function",
                        },
                      ],
                    });

                    formattedMessages.push({
                      role: "tool",
                      tool_call_id: currentToolCallId,
                      content: imageUrl,
                    });

                    res.write(
                      `data: ${JSON.stringify({
                        status: "done",
                        content: imageUrl,
                      })}\n\n`
                    );
                    response = null;
                    break;
                  }
                } catch (err) {
                  console.error("Error al procesar argumentos:", err);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error en el flujo:", error.message);
        res.status(500).send("Error en el flujo de respuesta");
      } finally {
        res.end();
      }
    }
    generate();
  } catch (error) {
    console.error("Error en la solicitud de chat:", error.message);
    res.status(500).json({
      error: error.message,
      status: "error",
    });
  }
});

module.exports = router;
