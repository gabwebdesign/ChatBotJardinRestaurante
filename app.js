import "dotenv/config";
import bot from "@bot-whatsapp/bot";
import { getDay } from "date-fns";
import QRPortalWeb from "@bot-whatsapp/portal";
import BaileysProvider from "@bot-whatsapp/provider/baileys";
import MockAdapter from "@bot-whatsapp/database/mock";

import chatgpt from "./services/openai/chatgpt.js";
import GoogleSheetService from "./services/sheets/index.js";

const googelSheet = new GoogleSheetService(
  "1EkQowqU5Bl4Iqpg9rfLAq9uMkoEMDOTF1Y61ihncTmI"
);

const GLOBAL_STATE = [];
const pedido = [];

const flowPrincipal = bot
  .addKeyword([
    "hola", 
    "hi",
    "buenas",
    "buenas dias",
    "buenas días",
    "buenas tardes",
  ])
  .addAnswer([
    `Bienvenidos a la soda El Jardín! 🧑‍🍳`,
    `Si te gustaría conocer nuestro menú del día 😋 escribe: *menu*`,
  ]);

const flowMenu = bot
  .addKeyword("menu")
  .addAnswer(
    `Hoy tenemos el siguiente menu:`,
    null,
    async (_, { flowDynamic }) => {
      const dayNumber = getDay(new Date());
      const getMenu = await googelSheet.retriveDayMenu(dayNumber);
      for (const menu of getMenu) {
        GLOBAL_STATE.push(menu);
        await flowDynamic(menu);
      }
    }
  )
  .addAnswer(
    `¿Te interesa alguno?`,
    { capture: true },
    async (ctx, { gotoFlow, state }) => {
      const txt = ctx.body;
      const check = await chatgpt.completion(`
    Hoy el menu de comida es el siguiente:
    "
    ${GLOBAL_STATE.join("\n")}
    "
    El cliente quiere "${txt}"
    Basado en el menu y lo que quiere el cliente determinar (EXISTE, NO_EXISTE), y si EXISTE
    determine la orden del cliente y determine cuanto tiene que pagar (ademas de incluir impuesto 13%)
    `);
      const getCheck = check.data.choices[0].message.content
        .trim()
        .replace("\n", "")
        .replace(".", "")
        .replace(" ", "");
      if (getCheck.includes("NO_EXISTE")) {
        return gotoFlow(flowEmpty);
      } else {
        // Store GPT response (order) in state
        const pedidoResponse = check.data.choices[0].message.content.trim();
        pedido.push(pedidoResponse)
        await state.update({ pedido: pedidoResponse });
        return gotoFlow(flowPedido);
      }
    }
  );

const flowEmpty = bot
  .addKeyword(bot.EVENTS.ACTION)
  .addAnswer("No tenemos eso por ahora!", null, async (_, { gotoFlow }) => {
    return gotoFlow(flowMenu);
  });

const flowPedido = bot
  .addKeyword('ver pedido')
  .addAction(
    async (ctx, {flowDynamic}) => {
      console.log(pedido)
      if (pedido.length > 0 && pedido[0]) {
        await flowDynamic([{ body: `${pedido[0].replace("EXISTE\n","")} \n `}]);
      } else {
        await flowDynamic([{ body: "No hay pedido disponible." }]);
      }
  })
  .addAnswer(
    "¿Está todo correcto?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ confirmacion: ctx.body });
    }
  )
  .addAction(
    async (ctx, {state,flowDynamic,gotoFlow}) => {
      const confirmation = state.getMyState().confirmacion;
      const checkGTP = await chatgpt.completion(`
      El cliente respondio ${confirmation}
      Dado un input del cliente, indica si la respuesta es afirmativa. Responde solo con "afirmativa" o "no afirmativa".
      `)
      const getCheckGTP = checkGTP.data.choices[0].message.content
        .trim()
        .replace("\n", "")
        .replace(".", "")
      console.log(getCheckGTP)
      if (getCheckGTP.includes("no afirmativa")) {
        await flowDynamic([{ body: `Disculpa, te mostramos nuestro menu de nuevo!`}]);
        return gotoFlow(flowMenu);
      }else{
        await flowDynamic([{ body: `Perfecto!`}]);
      }
  })
  .addAnswer(
    "¿Cual es tu nombre?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ name: ctx.body });
    }
  )  
  .addAnswer(
    "¿A donde te llevamos el pedido?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ direccion: ctx.body });
    }
  )
  .addAnswer(
    "¿Alguna observacion?",
    { capture: true },
    async (ctx, { state }) => {
      state.update({ observaciones: ctx.body });
    }
  )
  .addAnswer(
    "Perfecto tu pedido estara listo pronto. Muchas gracias",
    null,
    async (ctx, { state }) => {
        const currentState = state.getMyState();
      await googelSheet.saveOrder({
        fecha: new Date().toDateString(),
        telefono: ctx.from,
        pedido: currentState.pedido,
        nombre: currentState.name,
        direccion: currentState.direccion,
        observaciones: currentState.observaciones,
      });
    }
  );

const main = async () => {
  const adapterDB = new MockAdapter();
  const adapterFlow = bot.createFlow([
    flowPrincipal,
    flowMenu,
    flowPedido,
    flowEmpty,
  ]);
  const adapterProvider = bot.createProvider(BaileysProvider);

  bot.createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  QRPortalWeb();
};

main();
