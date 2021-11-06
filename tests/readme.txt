These tests expect two things:
1: there isn't an account using the cnpj "11111112122245" or the e-mail "vendedor@vendas.com".
2: there is a non-retailer account using the e-mail "comprador@compras.com" and password "senha".
3: the non-retailer account must have a balance of at least 10.20.
4: the daemon will be listening on localhost at the port 80.

To test, run "./node_modules/mocha/bin/mocha tests.js"
