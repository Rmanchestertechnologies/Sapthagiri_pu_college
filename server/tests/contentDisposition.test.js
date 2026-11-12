const http = require('http');
const { contentDisposition } = require('../utils/contentDisposition');

describe('contentDisposition', () => {
    test('plain titles keep their words joined by underscores', () => {
        expect(contentDisposition('Physics Unit Test 1', 'docx')).toMatch(/^attachment; filename="Physics_Unit_Test_1\.docx"/);
    });

    test('characters Node rejects in headers are removed from the plain name and encoded in filename*', () => {
        const h = contentDisposition('Physics – Unit Test ಎ', 'pdf');
        expect(h).toMatch(/filename="Physics_Unit_Test\.pdf"/);
        expect(h).toMatch(/filename\*=UTF-8''Physics_%E2%80%93_Unit_Test_%E0%B2%8E\.pdf/);
        expect(/^[\x20-\x7e]*$/.test(h)).toBe(true); // pure ASCII, so setHeader accepts it
    });

    test('quotes and line breaks cannot break out of the header', () => {
        const h = contentDisposition('a"b\r\nSet-Cookie: x=1', 'docx');
        expect(h).not.toMatch(/[\r\n]/);
        expect(h.match(/"/g).length).toBe(2);
    });

    test('empty names use the fallback', () => {
        expect(contentDisposition('', 'pdf', 'Result')).toMatch(/filename="Result\.pdf"/);
        expect(contentDisposition(null, 'pdf')).toMatch(/filename="download\.pdf"/);
        expect(contentDisposition('###', 'pdf', 'Result')).toMatch(/filename="Result\.pdf"/);
    });

    test('Node accepts the value as a real response header', done => {
        const server = http.createServer((req, res) => {
            res.setHeader('Content-Disposition', contentDisposition('Paper – ಎ "x"', 'docx'));
            res.end('ok');
        }).listen(0, () => {
            http.get({ port: server.address().port, agent: false, headers: { Connection: 'close' } }, res => {
                expect(res.headers['content-disposition']).toMatch(/^attachment; filename="Paper_x\.docx"/);
                res.resume();
                server.close(done);
            });
        });
    });
});
