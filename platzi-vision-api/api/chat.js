const express = require("express");
const bodyParser = require("body-parser");
const { OpenAI } = require("openai");

const router = express.Router();
const openai = new OpenAI();

router.use(bodyParser.json());

async function generated_image(prompt, quality = "standard") {
  try {
    const response = await openai.createImage({
      model: "dall-e-3",
      prompt: prompt,
      quality: quality,
      n: 1,
    });

    console.log("Imagen generada correctamente");
    return response.data.data[0].url;
  } catch (error) {
    console.error("Error al generar la imagen:", error.message);
    throw error;
  }
}


router.post('/', async (req, res) => {
try {
    const { messages } = req.body;

    const formattedMessages = [
      {
        role: "system",
        content:
          "Eres un asistente llamado PlatziVision. Responde a las preguntas de los usuarios sobre Platzi con claridad. Puedes generar imágenes en DALL-E 3. También puedes analizar imágenes que el usuario te envía.",
      },
    ];

    messages.forEach((message) => {
        if(message.image_data){
            const contentParts = [{
                type: "text",
                text: message.content
            }]

            message.image_data.forEach((imageDataBase64) => {
                contentParts.push({
                    type: "image_url",
                    image_url: {
                        url: `data:image/png;base64,${imageDataBase64}`,
                    }
                });
            });

            formattedMessages.push({
                role: message.role,
                content: contentParts
            });
        } else {
            formattedMessages.push({
                role: message.role,
                content: message.content
            });
        }
    });

    const tools = [
        {
            type: "function",
            function: {
                name: "generate_image",
                description: "Cuando el usuario lo solicite genera una imagen",
                parameters: {
                    type: "object",
                    properties: {
                        promt: {
                            type: "string",
                            description: "El promt que se usará para generar la imagen"
                        },
                        quality: {
                            type: "string",
                            description: "La calidad de la imagen puede ser 'hd' o 'standard'"
                        }
                    },
                },
            },
        }
    ];

    let accumulatedArgs = "";
    let response;
    let currentToolCallId = null;

		async function generate() {
			try {
				if(!response){
					response = await openai.chat.completions.create({
						model: "gpt-4o",
						messages: formattedMessages,
						stream: true,
						tools: tools,
					});
				}

				for await ( const chunk of response){
					if (chunk.choices[0].delta.content) {
						res.write(`data: ${JSON.stringify({
						content: chunk.choices[0]?.delta?.content || "",
						status: "streaming",
						})}\n\n`);
					}

                if(chunk.choices[0].finish_reason === "stop"){
                   	res.write(`data: ${JSON.stringify({ status: "done" })}\n\n`);
                    res.end();
                    break;
                }
                if(chunk.choices[0].delta.tool_calls){
                    const toolCalls = chunk.choices[0].delta.tool_calls;
                    if(toolCalls.id && toolCalls.function.name){
                        currentToolCallId = toolCalls.id;
                    }

                    if(toolCalls.function.arguments){
                        accumulatedArgs += toolCalls.function.arguments;

                        if(accumulatedArgs.trim().endsWith("}")){
                            try {
                                const functionArgs = JSON.parse(accumulatedArgs);

                                if(functionArgs.promt){
                                    res.write(`data: ${JSON.stringify({
                                    status: "generating_image",
                                })}\n\n`);

                                    const imageUrl = await generateImage(
                                        functionArgs.promt,
                                        functionArgs.quality
                                    );

                                    formattedMessages.push({
                                        role: "assistant",
                                        content: null,
                                        tool_calls: [{
                                            id: currentToolCallId,
                                            function: {
                                                name: "generated_image",
                                                arguments: accumulatedArgs,
                                            },
                                            type: "function",
                                        }]
                                    });

                                    formattedMessages.push({
                                        role: "tool",
                                        tool_call_id: currentToolCallId,
                                        content: imageUrl,
                                    });

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