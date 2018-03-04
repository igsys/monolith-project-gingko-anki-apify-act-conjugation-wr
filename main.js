const Apify = require('apify');
const typeCheck = require('type-check').typeCheck;
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const uniq = require('lodash').uniq

// Definition of the input
const INPUT_TYPE = `{
    source: String,
    query: String,
    dictionary: Maybe String,
}`;

Apify.main(async () => {
    // Fetch the input and check it has a valid format
    // You don't need to check the input, but it's a good practice.
    const input = await Apify.getValue('INPUT');
    if (!typeCheck(INPUT_TYPE, input)) {
        console.log('Expected input:');
        console.log(INPUT_TYPE);
        console.log('Received input:');
        console.dir(input);
        throw new Error('Received invalid input');
    }

    // Environment variables
    const launchPuppeteer = process.env.NODE_ENV === 'development' ? puppeteer.launch : Apify.launchPuppeteer;

    // Navigate to page
    // const uri = `http://conjugator.reverso.net/conjugation-${input.source}-verb-${input.query}.html`
    const uri = `http://www.wordreference.com/conj/FrVerbs.aspx?v=${input.query}`
    const browser = await launchPuppeteer();
    const page = await browser.newPage();
    await page.goto(uri);

    let html = await page.content();
    const $ = cheerio.load(html);

    // Get verb conjugation list
    let results = [];

    // $('.verbtxt').each((i, elem) => {
    //     const txt = $(elem).text().trim();
    //     const splitted = txt.split('/');
    //     results = results.concat(splitted);
    // });

    $('.aa').each((i, elem) => {
        const form = $(elem).find('h4').text().trim()
        // $(elem).find('tr').each((j, elem2) => {
        //     const tense = $(elem2).eq(0).text().trim()
        //     // Do not add first <tr> tag, that indicates the tense
        //     j == 0 ?
        //         null :
        //         results.push({
        //             form,
        //             tense,
        //             conjugation: $(elem2).eq(j).text().trim()
        //         })
        // })
        $(elem).find('tbody').each((j, elem2) => {
            const tense = $(elem2).find('tr').eq(0).text().trim();
            $(elem2).find('tr').each((k, elem3) => {
                // Do not add first <tr> tag, that indicates the tense
                k == 0 ?
                    null :
                    results.push({
                        form,
                        tense,
                        conjugation: $(elem3).find('td').text().trim()
                    })
            })
        })
    });

    // Here's the place for your magic...
    console.log(`Input query: ${input.query}`);
    // console.log('Result: ', uniq(results));
    console.log('Results: ', results)

    // Store the output
    const output = {
        name: 'apify/igsys/conjugation-wr',
        crawledAt: new Date(),
        input,
        results,
        // conjugation: uniq(results)
    };
    await Apify.setValue('OUTPUT', output)
});
