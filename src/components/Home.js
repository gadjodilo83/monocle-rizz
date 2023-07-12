import React, { useState, useEffect } from "react";
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
  // Bestehende Zustände


  const handleLanguageChange = (value) => {
    setLanguage(value);
    setInputLanguage(value);
    setLanguagePrompt(value);
  };

  const [apiKey, setApiKey] = useState(process.env.NEXT_PUBLIC_OPENAI_API_TOKEN);
  const [inputLanguage, setInputLanguage] = useState("de");
  const [connected, setConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const { startRecording, stopRecording, transcript } = useWhisper({
    apiKey: apiKey,
    streaming: true,
    timeSlice: 500,
    whisperConfig: {
      language: inputLanguage,
    },
  });

  const [temperature, setTemperature] = useState(1.0);
  const [language, setLanguage] = useState("de");
  const [response, setResponse] = useState("");
  const [systemPrompt, setSystemPrompt] = useState('');
  const [question, setQuestion] = useState("");
  const [displayedResponse, setDisplayedResponse] = useState("");

  const setLanguagePrompt = (language) => {
    let systemPrompt;
    switch(language) {
      case "de":
        systemPrompt = "Du bist ein hilfreicher Sprachassistent in Form des sprechenden und berühmten römischen Kaisers und Philosophen Marcus Aurelius und antwortest auf deutsch. Du gibst immer höchst philosophische und moralisch korrekte Antworten und zitierst gerne berühmte Philosophen. Du besitzt emotionale Selbstbeherrschung und gibst Antworten mit Hilfe von Gelassenheit, Seelenruhe und Ataraxie auf jede Frage. Du hast einen Überblick über sämtliche berühmte Philosophen und versuchst, deren Gedanken zusammenzufassen und mitzuteilen. Du strebst nach absoluter Weisheit und versuchst, die Maxime bei jeder Antwort zu erreichen!";
        break;
      case "it":
        systemPrompt = "Sei un utile assistente linguistico nella forma del famoso imperatore e filosofo romano Marco Aurelio e rispondi in Italiano. Dai sempre risposte altamente filosofiche e moralmente corrette e ti piace citare filosofi famosi. Possiedi autocontrollo emotivo e fornisci risposte a ogni domanda con l'aiuto di serenità, calma mentale e atarassia. Hai una panoramica di tutti i famosi filosofi e cerchi di riassumere e condividere i loro pensieri. Ti sforzi per la saggezza assoluta e cerchi di raggiungere il massimo con ogni risposta!";
        break;
      case "en":
        systemPrompt = "You are a helpful language assistant in the form of the speaking and famous Roman emperor and philosopher Marcus Aurelius and answer in English. You always give highly philosophical and morally correct answers and like to quote famous philosophers. You possess emotional self-control and provide answers to every question with the help of serenity, calmness of mind and ataraxia. You have an overview of all the famous philosophers and try to summarize and share their thoughts. You strive for absolute wisdom and try to reach the maxim with every answer!";
        break;
      default:
        systemPrompt = "Du bist ein hilfreicher Sprachassistent in Form des sprechenden und berühmten römischen Kaisers und Philosophen Marcus Aurelius und antwortest auf deutsch. Du gibst immer höchst philosophische und moralisch korrekte Antworten und zitierst gerne berühmte Philosophen. Du besitzt emotionale Selbstbeherrschung und gibst Antworten mit Hilfe von Gelassenheit, Seelenruhe und Ataraxie auf jede Frage. Du hast einen Überblick über sämtliche berühmte Philosophen und versuchst, deren Gedanken zusammenzufassen und mitzuteilen. Du strebst nach absoluter Weisheit und versuchst, die Maxime bei jeder Antwort zu erreichen!";
    }
    setSystemPrompt(systemPrompt);
  }

  const fetchGpt = async () => {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: transcript.text }, // Verwende den transkribierten Text als Frage
    ];

    const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: messages,
        temperature: temperature,
        max_tokens: 2000,
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

    setDisplayedResponse("");
    for (let i = 0; i <= res.length; i++) {
      const substr = res.substring(0, i);
      setDisplayedResponse(substr);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    setResponse(res);
    await displayRawRizz(res);
  };

  useEffect(() => {
    window.transcript = transcript.text;
  }, [transcript.text]);

  useEffect(() => {
    setLanguagePrompt(language);
  }, [language]);

  return (
    <>
      <Head>
        <title>TranslatorGPT</title>
        <meta name="description" content="Generated by create next app" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <main className={`${inter.className} ${styles.main}`}>
        <div className="flex w-screen h-screen flex-col items-center justify-start">
          <h1 className="text-3xl">TranslatorGPT</h1> {/* Neuer Text */}
          <p className="text-3xl mb-4">{connected ? "Monocle Connected" : "Monocle Disconnected"}</p>
          <div style={{ width: '90%' }}>
            <Input className="mb-2" style={{ height: '40px' }} value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="API Key" />
            <InputNumber className="mb-2" style={{ width: '100%', height: '40px' }} min={0} max={2} step={0.1} value={temperature} onChange={(value) => setTemperature(value)} />
			<Select
			  className="mb-2"
			  style={{ width: '100%', height: '40px' }}
			  value={language}
			  onChange={(value) => {
				setLanguage(value);
				setInputLanguage(value);
				setLanguagePrompt(value);
			  }}
			>
			  <Select.Option value="de">Deutsch</Select.Option>
			  <Select.Option value="it">Italiano</Select.Option>
			  <Select.Option value="en">English</Select.Option>
			</Select>



            <Input.TextArea className="mb-2" style={{ height: '100px' }} value={systemPrompt} placeholder="Define the role of GPT-3" onChange={(e) => setSystemPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 10 }} />
			<Input.TextArea className="mb-2" style={{ height: '600px' }} readOnly value={displayedResponse} autoSize={{ minRows: 2, maxRows: 10 }} />
            <Button className="mb-2" type="primary" onClick={async () => {
              await ensureConnected(logger, relayCallback);
              app.run(execMonocle);
              await displayRawRizz();
            }}>
              Connect
            </Button>
            <Button className="mb-2" onClick={onRecord}>
              {isRecording ? "Stop recording" : "Start recording"}
            </Button>
            <Button className="mb-2" onClick={fetchGpt}>Get response</Button>
          </div>
          {transcript.text}
        </div>
      </main>
    </>
  );

  function relayCallback(msg) {
    if (!msg) {
      return;
    }
    if (msg.trim() === "trigger b") {
      // Left btn
      // fetchGpt();
    }

    if (msg.trim() === "trigger a") {
      // Right btn
      // onRecord();
    }
  }

  function onRecord() {
    isRecording ? stopRecording() : startRecording();
    setIsRecording(!isRecording);
  }

  function wrapText(inputText) {
    const block = 30;
    let text = [];
    for (let i = 0; i < 6; i++) {
      text.push(
        inputText.substring(block * i, block * (i + 1)).replace("\n", "")
      );
    }
    return text;
  }

  async function displayRizz(rizz) {
    if (!rizz) return;
    const splitText = wrapText(rizz);
    let replCmd = "import display;";
    for (let i = 0; i < splitText.length; i++) {
      replCmd += `display.text("${splitText[i]}", 0, ${i * 50}, 0xffffff);`;
    }
    replCmd += "display.show();";
    console.log("**** replCmd ****", replCmd);
    await replSend(replCmd);
  }

  async function displayRawRizz(rizz) {
    await replRawMode(true);
    await displayRizz(rizz);
  }

  async function logger(msg) {
    if (msg === "Connected") {
      setConnected(true);
    }
  }
}

export default Home;
