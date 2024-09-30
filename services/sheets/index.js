import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";

const SCOPES = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.file",
];

class GoogleSheetService {
  jwtFromEnv = undefined;
  doc = undefined;

  constructor(id = undefined) {
    if (!id) {
      throw new Error("ID_UNDEFINED");
    }

    this.jwtFromEnv = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });
    this.doc = new GoogleSpreadsheet(id, this.jwtFromEnv);
  }

  /**
   * Recuperar el menu del dia
   * @param {*} dayNumber
   * @returns
   */
  retriveDayMenu = async (dayNumber = 0) => {
    const doc = await this.doc;
    const info = await doc.loadInfo();
    //console.log("info desde google --- ",doc)
    try {
      const list = [];
      await this.doc.loadInfo();
      const sheet = this.doc.sheetsByIndex[0]; // the first sheet
      
      await sheet.loadCells("A1:H10");
      const rows = await sheet.getRows();
      //console.log("info desde google --- ",rows)
      for (const a of Array.from(Array(rows.length).keys())) {
        const cellA1 = sheet.getCell(a + 1, dayNumber - 1);
        list.push(cellA1.value);
      }

      return list;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  };

  /**
   * Recuperar tiempos disponibles
   * @returns
   */

  retriveDatesAvailable = async () => {
    try {
      const list = [];
      const doc = await this.doc;
      await this.doc.loadInfo();
      const sheet = this.doc.sheetsByTitle["entrega"];
      await sheet.loadCells("A1:B18");
      const rows = await sheet.getRows();
      for (let a = 1; a < 18; a++) {
        const cell = sheet.getCell(a, 0); 
        const cellColumnSecond = sheet.getCell(a, 1); 
        const availability = cellColumnSecond.formattedValue;
        const rawData = cell.formattedValue;
        if(availability==null){
          list.push(rawData); 
        }
      }
      return list;
    } catch (err) {
      console.log(err);
      return undefined;
    }
  };

  /**
   * Guardar pedido
   * @param {*} data
   */
  saveOrder = async (data = {}) => {
    await this.doc.loadInfo();
    const sheet = this.doc.sheetsByIndex[1]; // the first sheet
    const order = await sheet.addRow({
      fecha: data.fecha,
      telefono: data.telefono,
      nombre: data.nombre,
      pedido: data.pedido,
      direccion:data.direccion,
      observaciones: data.observaciones,
      entrega:data.entrega
    });

    return order
  };
}

export default GoogleSheetService;
