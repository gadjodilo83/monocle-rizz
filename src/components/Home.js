import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { Inter } from "next/font/google";
import styles from "@/styles/Home.module.css";
import { ensureConnected } from "@/utils/bluetooth/js/main";
import { replRawMode, replSend } from "@/utils/bluetooth/js/repl";
import { Button, Select, Input, InputNumber } from "antd";
import { useWhisper } from "@chengsokdara/use-whisper";
import { app } from "@/utils/app";
import { execMonocle } from "@/utils/comms";

const inter = Inter({ subsets: ["latin"] });

const Home = () => {
  const handleLanguageChange = (value) => {
    setLanguage(value);
    setInputLanguage(value);
    setLanguagePrompt(value);
  };

  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_TOKEN);
  const [inputLanguage, setInputLanguage] = useState("de");
  const [connected, setConnected] = useState(false);
  const [isRecordingState, setIsRecordingState] = useState(false);
  const isRecording = useRef(isRecordingState);
  const setIsRecording = (value) => {
    isRecording.current = value;
    setIsRecordingState(value);
  };
  const { startRecording: whisperStartRecording, stopRecording: whisperStopRecording, transcript } = useWhisper({
		apiKey: apiKey,
		streaming: true,
		timeSlice: 500,
		whisperConfig: {
		  language: inputLanguage,
		},
	});



const startMyRecording = async () => {
  const textCmd = `display.Text('Start Record', 320, 200, 0xffffff, justify=display.MIDDLE_CENTER)`;
  const lineCmd = `display.Line(175, 230, 465, 230, 0xffffff)`;
  const showCmd = `display.show([${textCmd}, ${lineCmd}])`;
  await replSend(`${textCmd}\n${lineCmd}\n${showCmd}\n`);
  whisperStartRecording();
  setIsRecording(true);
}


const stopMyRecording = async () => {
  const textCmd = `display.Text('Stop Record', 320, 200, 0xffffff, justify=display.MIDDLE_CENTER)`;
  const lineCmd = `display.Line(175, 230, 465, 230, 0xffffff)`;
  const showCmd = `display.show([${textCmd}, ${lineCmd}])`;
  await replSend(`${textCmd}\n${lineCmd}\n${showCmd}\n`);
    whisperStopRecording();
    setIsRecording(false);
    if (transcript.text) {
      await fetchGpt();
    } else {
      console.log('No transcript available');
    }
}


const relayCallback = (msg) => {
  if (!msg) {
    return;
  }
  if (msg.trim() === "trigger b") {
    // Left btn
    console.log("Button B pressed");  // New line
    fetchGpt();
  }

  if (msg.trim() === "trigger a") {
    // Right btn
    if(isRecording.current) {
        stopMyRecording();
    } else {
        startMyRecording();
    }
  }
}

const onRecord = () => {
  if(isRecording.current) {
    stopMyRecording();
  } else {
    startMyRecording();
  }
};





  const [temperature, setTemperature] = useState(0.5);
  const [language, setLanguage] = useState("de");
  const [response, setResponse] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [question, setQuestion] = useState("");
  const [displayedResponse, setDisplayedResponse] = useState("");

  const setLanguagePrompt = (language) => {
    let systemPrompt;
    switch (language) {
      case "de":
        systemPrompt =
          "Du bist nur ein Übersetzer und übersetzt alles direkt auf Italienisch. Danach gibst du Vorschläge, wie auf Fragen geantwortet werden kann oder wie das Gespräch fortgesetzt werden könnte, jeweils auf Deutsch und Italienisch.";
        break;
      case "it":
        systemPrompt =
          "Sei solo un traduttore e traduci tutto direttamente in tedesco. Poi dai suggerimenti su come rispondere alle domande o su come potrebbe continuare la conversazione, rispettivamente in tedesco e in italiano.";
        break;
      case "en":
        systemPrompt =
          "You are a translator and translate any input directly into Italian and German. You also give suggestions on how to answer questions or how to continue the conversation, both in German and Italian.";
        break;
      default:
        systemPrompt =
          "Du bist nur ein Übersetzer und übersetzt alles direkt auf Italienisch. Danach gibst du Vorschläge, wie auf Fragen geantwortet werden kann oder wie das Gespräch fortgesetzt werden könnte, jeweils auf Deutsch und Italienisch.";
    }
    setSystemPrompt(systemPrompt);
  };

const fetchGpt = async () => {
  console.log("fetchGpt called");
  try {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript.text }, // Verwende den transkribierten Text als Frage
    ];

    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: temperature,
        max_tokens: 250,
      }),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      method: "POST",
    });

    if (!response.ok) {
      const message = await response.text();
      console.error("API request error:", response.status, message);
      throw new Error(`API request failed: ${message}`);
    }

    const resJson = await response.json();
    const res = resJson?.choices?.[0]?.message?.content;
    if (!res) return;

    setDisplayedResponse(res);
    setResponse(res);
    await displayRawRizz(res);
  } catch (err) {
    console.error(err);
  }
};



useEffect(() => {
    if (!isRecording.current && transcript.text) {
        fetchGpt();
    }
}, [transcript.text]);


  useEffect(() => {
    window.transcript = transcript.text;
  }, [transcript.text]);

  useEffect(() => {
    setLanguagePrompt(language);
  }, [language]);

  return (
    <>
      <Head>
        <title>translatorGPT</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${inter.className} ${styles.main}`}>
        <div className="flex w-screen h-screen flex-col items-center justify-start">
          <h1 className="text-3xl">translatorGPT</h1>
          <p className="text-3xl mb-4">
            {connected ? "Monocle Connected" : "Monocle Disconnected"}
          </p>
          <div style={{ width: "90%" }}>
            <Input
              className="mb-2"
              style={{ height: "40px" }}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="API Key"
            />
            <InputNumber
              className="mb-2"
              style={{ width: "100%", height: "40px" }}
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(value) => setTemperature(value)}
            />
            <Select
              className="mb-2"
              style={{ width: "100%", height: "40px" }}
              value={language}
              onChange={handleLanguageChange}
            >
              <Select.Option value="de">Deutsch</Select.Option>
              <Select.Option value="it">Italiano</Select.Option>
              <Select.Option value="en">English</Select.Option>
            </Select>
            <Input.TextArea
              className="mb-2"
              style={{ height: "100px" }}
              value={systemPrompt}
              placeholder="Define the role of GPT-3"
              onChange={(e) => setSystemPrompt(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 10 }}
            />
            <Button
              className="mb-2"
              type="primary"
              onClick={async () => {
                await ensureConnected(logger, relayCallback);
                app.run(execMonocle);
                await displayRawRizz();
              }}
            >
              Connect
            </Button>
            <Button className="mb-2" onClick={onRecord}>
              {isRecording ? "Stop recording" : "Start recording"}
            </Button>
            <Button className="mb-2" onClick={fetchGpt}>
              Get response
            </Button>
          </div>
          {transcript.text}
        </div>
      </main>
    </>
  );




  async function displayRawRizz(rizz) {
    await replRawMode(true);
    await displayRizz(rizz);
  }

async function displayRizz(rizz) {
  if (!rizz) return;

  const splitText = wrapText(rizz);
  const groupSize = 4;

  for (let i = 0; i < splitText.length; i += groupSize) {
    const group = splitText.slice(i, i + groupSize);
    const textCmds = group.map((text, index) => {
      const xCoordinate = 0; // Beispielwert für die x-Koordinate
      const yCoordinate = index * 50; // Zeilen t1 bis t4
      return `display.Text('${cleanText(text.replace(/"/g, ""))}', ${xCoordinate}, ${yCoordinate}, 0xffffff)`;
    });

    const textCmd = `display.show([${textCmds.join(", ")}])`;
    const clearCmd = "display.clear()";

    await delay(100); // 2.5 Sekunden warten
    await replSend(`${clearCmd}\n${textCmd}\n`); // clear() und display.show senden
	await delay(7000); // 2.5 Sekunden warten

  }
}


function chunkArray(array, size) {
  const result = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
}

	function cleanText(inputText) {
	  let cleanedText = inputText.replace(/\\/g, ""); // remove backslashes
	  cleanedText = cleanedText.replace(/""/g, '"'); // replace double quotes with single quotes
	  cleanedText = cleanedText.replace(/\n/g, ""); // remove line breaks
	  return cleanedText;
	}

	async function delay(ms) {
	  return new Promise((resolve) => setTimeout(resolve, ms));
	}

	async function logger(msg) {
	  if (msg === "Connected") {
		setConnected(true);
	  }
	}


  function wrapText(inputText) {
    const block = 25;
    const regex = /0xffffff\)(?!$)/g; // Negative Lookahead regex to match "0xffffff)" not at the end of the string
    let text = [];
    let currentIndex = 0;

    while (currentIndex < inputText.length) {
      const substring = inputText.substring(currentIndex, currentIndex + block);
      const match = substring.match(regex);
      const endIndex = match ? currentIndex + match.index + 25 : currentIndex + block;
      const wrappedSubstring = inputText.substring(currentIndex, endIndex);
      text.push(wrappedSubstring);
      currentIndex = endIndex;
    }

    return text;
  }
};

export default Home;
