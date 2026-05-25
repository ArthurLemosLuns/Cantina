const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();

// Permite que o frontend (HTML) faça requisições para esta API
app.use(cors());
// Permite que a API entenda dados enviados no formato JSON
app.use(express.json());

// Conecta ao banco (cria o arquivo cantina.db automaticamente na pasta)
const db = new sqlite3.Database('./cantina.db', (err) => {
    if (err) {
        console.error("Erro ao conectar ao banco:", err.message);
    } else {
        console.log('Conectado ao banco de dados SQLite.');
    }
});

// Inicialização do Banco de Dados
db.serialize(() => {
    // Cria a tabela de produtos
    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT,
        preco REAL,
        estoque INTEGER
    )`);

    // Verifica se a tabela está vazia. Se estiver, insere os lanches
    db.get("SELECT COUNT(*) as count FROM produtos", (err, row) => {
        if (row.count === 0) {
            const stmt = db.prepare("INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)");
            stmt.run("Coxinha de Frango", 6.00, 15);
            stmt.run("Pão de Queijo", 4.50, 10);
            stmt.run("Refrigerante Lata", 5.00, 0); // Zero estoque para testar o botão cinza
            stmt.run("Brigadeiro", 3.00, 20);
            stmt.finalize();
            console.log("Produtos iniciais cadastrados com sucesso!");
        }
    });
});

// Rota 1: Enviar os produtos e o estoque para o frontend
app.get('/api/produtos', (req, res) => {
    db.all("SELECT * FROM produtos", [], (err, rows) => {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        // Retorna a lista de produtos em formato JSON
        res.json(rows);
    });
});

// Rota 2: Processar a compra e dar baixa no estoque
app.post('/api/comprar', (req, res) => {
    const carrinho = req.body.carrinho; // Recebe o array do carrinho
    
    // Inicia a verificação e atualização de cada item
    let erros = [];

    carrinho.forEach(item => {
        // Atualiza o estoque reduzindo a quantidade comprada, apenas se houver estoque suficiente
        db.run(`UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?`, 
            [item.quantidade, item.id, item.quantidade], 
            function(err) {
                if (err) {
                    erros.push(item.nome);
                } else if (this.changes === 0) {
                    // this.changes indica quantas linhas foram alteradas. Se for 0, faltou estoque no momento exato da compra.
                    console.log(`Estoque insuficiente para: ${item.nome}`);
                }
        });
    });

    if (erros.length > 0) {
        res.status(400).json({ mensagem: "Erro ao processar alguns itens", erros });
    } else {
        res.json({ mensagem: "Compra finalizada com sucesso! Estoque atualizado." });
    }
});

// Inicia o servidor na porta 3000
app.listen(3000, () => {
    console.log('API da Cantina rodando em http://localhost:3000');
});

// Rota 3: Cadastrar um novo produto no banco de dados
app.post('/api/produtos', (req, res) => {
    // Recebe os dados enviados pelo navegador
    const { nome, preco, estoque } = req.body;

    // Insere no banco de dados
    const query = `INSERT INTO produtos (nome, preco, estoque) VALUES (?, ?, ?)`;
    
    db.run(query, [nome, preco, estoque], function(err) {
        if (err) {
            res.status(500).json({ erro: err.message });
            return;
        }
        // Retorna sucesso e o ID do novo produto
        res.json({ 
            mensagem: "Produto cadastrado com sucesso!", 
            id_produto: this.lastID // this.lastID pega o número da linha que acabou de ser criada
        });
    });
});