const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const { google } = require('googleapis');
const keys = require('./woori-344909-41d58b6f283d.json');
const dayjs = require('dayjs');
const timezone = require('dayjs/plugin/timezone');
const utc = require('dayjs/plugin/utc');
var cron = require('node-cron');
const solapi = require("solapi").default;

require("dotenv").config();

const messageService = new solapi(process.env.API, process.env.KEY);

dayjs.extend(utc);
dayjs.extend(timezone);

const ID = process.env.ID;
const PW = process.env.PW;
const DATE = process.argv[2];

const NOW = dayjs(DATE);
const DAY = NOW.subtract(1, "d").format('YYYY-MM-DD');


const client = new google.auth.JWT(
    keys.client_email,
    null,
    keys.private_key,
    ["https://www.googleapis.com/auth/spreadsheets"]
);

async function gsrunWrite (cl, data, index, category) {
  const gsapi = google.sheets({version: "v4", auth: cl});

  const updateOpt = {
      spreadsheetId: "1Bd7_Nc0cQa-6k3AMiVlRU6781SODla1XlZeDc2p2f7E",
      range: `A2`,
      valueInputOption: "USER_ENTERED",
      resource: {
          values: data
      }
  };

  let response = await gsapi.spreadsheets.values.update(updateOpt);

  // console.log(response.data);

  return response.data.updatedRows;
}

async function scraperListing(page, targetPage) {
  let array = [];

  await page.goto(LGURL["kangwhareal"] + `&page=${targetPage}`, {
      waitUntil: 'networkidle2',
  });

  const html = await page.content();
  const $ = cheerio.load(html);
  // console.log($('.goods__item').length);
  Array.from($('.goods__item')).forEach((el, index) => {
      const item = {
          item__name: $(el).find('.item__name').text(),
          item__code: $(el).find('.item__code').text(),
          item__img: $(el).find('.item__img img').attr('src'),
          item__new: "",
          item__best: "",
      }
      item.item__new = $(el).find('.item__ico--new').text();
      item.item__best = $(el).find('.item__ico--best').text();
      array.push(item);
  });

  return array;
}

async function sleep(miliseconds) {
  return new Promise(resolve => setTimeout(resolve, miliseconds));
}

async function main() {
    const browser = await puppeteer.launch({
        headless : true,
        defaultViewport: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const naver_id = ID;
    const naver_pw = PW;
    await page.goto('https://nid.naver.com/nidlogin.login');
    await page.evaluate((id, pw) => {
        document.querySelector('#id').value = id;
        document.querySelector('#pw').value = pw;
    }, naver_id, naver_pw);
    await page.click('.btn_login');
    await page.waitForNavigation();
    // https://partner.booking.naver.com/api/bookings?bizItemTypes=STANDARD&bizItemTypes=STANDARD&bookingStatusCodes=RC03&dateDropdownType=TODAY&dateFilter=USEDATE&endDateTime=2022-03-22T10%3A03%3A36.672Z&maxDays=31&nPayChargedStatusCodes=&orderBy=&orderByStartDate=ASC&paymentStatusCodes=&searchValue=&searchValueCode=USER_NAME&startDateTime=2022-03-22T10%3A03%3A36.672Z&page=0&size=50&noCache=1647943447646
    await page.goto(`https://partner.booking.naver.com/api/bookings?bizItemTypes=STANDARD&bizItemTypes=STANDARD&bookingStatusCodes=RC03&dateDropdownType=TODAY&dateFilter=USEDATE&endDateTime=${DAY}T15%3A00%3A00.000Z&maxDays=31&nPayChargedStatusCodes=&orderBy=&orderByStartDate=ASC&paymentStatusCodes=&searchValue=&searchValueCode=USER_NAME&startDateTime=${DAY}T15%3A00%3A00.000Z&page=0&size=100`);

    await page.content();

    let innerText = await page.evaluate(() =>  {
      return JSON.parse(document.querySelector("body").innerText); 
    }); 

    // console.log("innerText now contains the JSON");
    // console.log(innerText);

    innerText.forEach(function(item) {
      // console.log(item);
    });

    // page.on('response', async response => {
    //   console.log('got response', response);
    // });

    // let data = [];

    // console.log(data);

    // for(let i = 1; i <= 3; i++) {
    //   await crawlerLg(page, i, "");
    // }

    await crawlerWoori(innerText);

    // browser.close();

    // await browser.close();

    browser.close();
}

const crawlerWoori = async (list) => {
  // let listings = await scraperListing(page, num);

  // let inputList = listings.map((el) => {
  //     let result = [];
  //     result.push(
  //         el.item__name,
  //         el.item__code,
  //         LGHOMEURL + el.item__img,
  //         el.item__new,
  //         el.item__best,
  //         '마루',
  //         'lg',
  //         'kang',
  //         'super',
  //     );
  //     return result;
  // });
  
  let listing = list.map((el) => {
      let result = [];
      result.push(
          el.serviceName,
          el.name,
          el.bizItemName,
        //   el.bookingGuide,
        //   el.snapshotJson.bookingPrecaution,
          el.snapshotJson.startDateTime,
          el.snapshotJson.endDateTime,
          el.snapshotJson.bookingCount,
          el.phone,
          el.price,
          el.snapshotJson.businessId,
          el.snapshotJson.businessAddressJson.detail
      );
      return result;
  });

  client.authorize(async (err, tokens) => {

    let filtered_list = listing.map(el => {
      return {
          "total": listing.length,
          "phone": el[6],
          "bizId": el[8],
          "time": el[3].substring(11, 19),
          "sdiff": dayjs(el[3]).tz("Asia/Seoul").diff(dayjs(new Date()).tz("Asia/Seoul"), 'm'),
          "ediff": dayjs(el[4]).tz("Asia/Seoul").diff(dayjs(new Date()).tz("Asia/Seoul"), 'm'),
          "detail": el[9],
          "name": el[0]
      }
    });

    console.log(filtered_list);

    filtered_list.forEach(function(el) {
      if (el.sdiff < 30 && el.sdiff >= 0) {
        console.log(`${el.phone} 에게 시작 메세지 보냄`);
        messageService.sendOne({
          to: "01056552997",
          from: "01086122382",
          text: `${el.phone} 님 우리끼리 ${el.name}를 이용해주셔서 감사합니다.\n\n[매장위치]${el.detail}\n\nhttp://pf.kakao.com/_pFUPb 카카오채널을 통해 더 많은 혜택을 받아보세요`,
          subject: "우리끼리 이용안내" // LMS, MMS 전용 옵션, SMS에서 해당 파라미터 추가될 경우 자동으로 LMS 변경처리 됨
        }).then(res => console.log(res));
      }
    });

    filtered_list.forEach(function(el) {
      if (el.ediff < 30 && el.ediff >= 0) {
        messageService.sendOne({
          to: "01086122382",
          from: "01086122382",
          text: `${el.phone} 님 우리끼리 ${el.name}를 이용해주셔서 감사합니다.\n\n http://pf.kakao.com/_pFUPb 카카오채널을 통해 더 많은 혜택을 받아보세요`,
          subject: "우리끼리 이용안내" // LMS, MMS 전용 옵션, SMS에서 해당 파라미터 추가될 경우 자동으로 LMS 변경처리 됨
        }).then(res => console.log(res));
      }
    });

    //   if (err) {
    //       console.log(err);
    //       return;
    //   } else {
    //       console.log("Connected Success.");
    //       console.log(listing);
    //     //   await gsrunWrite(client, listing);
    //       // index += await gsrunWrite(client, inputList, index, category);
    //       await sleep(1000);
    //   }
  });

  await sleep(1000);
}


cron.schedule('0 * * * *', function(){
  console.log('cron start');
  main();
});

cron.schedule('30 * * * *', function(){
  console.log('cron start');
  main();
});



async function getAll(page, index) {
    let data = [];
    let lineCount = 30;
    const maxCount = 30;
    const allMail = await page.$eval("#headTotalNum", (data) => data.textContent);
    let pageCount = parseInt(allMail/30 + 1);
    if(index === pageCount){
        lineCount = (allMail%30);
    } else {
        lineCount = maxCount;
    }

    for (let index = 0; index < lineCount; index++) {
        data.push(await getOne(page, index + 1));
    }

    return Promise.resolve(data);
}

async function getOne(page, index) {

    let data = {};

    data.title = await page.$eval(`#list_for_view > ol > li:nth-child(${index}) > div > div.subject > a > span > strong`, (data) => data.textContent);

    data.link = await page.$eval(`#list_for_view > ol > li:nth-child(${index}) > div > div.subject > a`, (data) => data.href);

    data.from = await page.$eval(`#list_for_view > ol > li:nth-child(${index}) > div > div > a`, (data) => data.textContent);

    return Promise.resolve(data);
}