const chai = require("chai");
const chaiHttp = require("chai-http");
const expect = chai.expect
const baseUrl = "localhost"
chai.use(chaiHttp);
describe("Wallets tests", function(){
  
    var session;
    var id;
  
    it('create account', function(done) {
        
        chai.request(baseUrl)
        .put('/account')
        .send({
         identifier: '111111121.222-45',
         name: 'Vendedor',
         retailer : true,
         email: 'vendedor@vendas.com',
         password: 'senha' })
        .end(function (err, res) {
            expect(res).to.have.status(200);
            expect(res.body.status).to.be.equal('ok')
            done();
        });
        
    });
    it('login', function(done) {
      
       chai.request(baseUrl)
            .post('/login')
            .send({
             login: 'comprador@compras.com',
             password: 'senha' })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body.status).to.be.equal('ok')
                expect(res.body).to.have.property('session')
                expect(res.body).to.have.property('id')
                
                session = res.body.session
                id = res.body.id
                
                done();
            });
    });
    
    it('transfer', function(done) {
       
       chai.request(baseUrl)
            .post('/transfer')
            .send({
             id: id,
             destination: '1111111.21222-45',
             value: 10.20,
             session: session })
            .end(function (err, res) {
                expect(res).to.have.status(200);
                expect(res.body.status).to.be.equal('ok')

                done();
            });
       
    });
    
})
