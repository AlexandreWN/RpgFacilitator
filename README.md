# RPG Facilitator

Sistema local para **desenhar fichas de RPG** e jogar com elas. Você monta a ficha arrastando campos para onde quiser, escolhe o formato de cada lista (armas, magias…) e só depois configura as **funções** com blocos: rolagens, crítico, alteração de valores.

## Como rodar

Requer Node 20+.

```bash
npm install
npm run dev
```

Abra http://localhost:5173 (a API roda em http://localhost:3001; mude com `RPG_API_PORT`).

| Comando | O que faz |
| --- | --- |
| `npm start` | Gera o build e serve tudo pela API em http://localhost:3001 |
| `npm test` | Testes do rolador de dados, interpretador e compilador de blocos |
| `npm run typecheck` | Checagem de tipos |
| `npm run exemplo` | (Re)gera o template `exemplo-dnd` e o personagem `thorin-exemplo` |

## Onde ficam os arquivos

Tudo em `data/` (ou na pasta de `RPG_DATA_DIR`), um `.txt` com JSON por item:

```
data/templates/<id>.txt      templates de ficha
data/personagens/<id>.txt    uma ficha por personagem
data/blocos/<id>.txt         blocos personalizados
```

## O editor de template

Duas abas, na ordem do trabalho:

### 1 · Layout — onde cada coisa fica

A ficha é uma grade de 12 colunas. Arraste da paleta para a ficha; o elemento encaixa na grade. Arraste um elemento para movê-lo e puxe o canto inferior direito para redimensionar. Clicando nele, o painel da direita mostra as propriedades.

| Elemento | Para quê |
| --- | --- |
| Campo número / texto / dados / sim-não | os valores que o jogador preenche |
| Campo calculado | valor automático, com fórmula em texto: `piso((FOR-10)/2)` |
| Seção | caixa com título e grade própria, para agrupar campos |
| Lista de itens | armas, magias, itens — você desenha **um item** e escolhe o **formato** |
| Título / nota | texto solto na ficha |
| Botão de ação | cria uma ação nova, que você programa na aba Funções |

Cada campo tem um **id** (ex.: `FOR`), usado nas fórmulas e nas expressões de dados.

**Formatos de lista:** cartões lado a lado, uma linha por item, ou tabela (cada campo vira uma coluna, na ordem do desenho).

### 2 · Funções — o que cada botão faz

À esquerda ficam as ações: as da ficha e as de cada lista. Selecione uma e monte os comandos com blocos. À direita, a ficha de teste com o log de rolagens, para experimentar na hora.

| Categoria | Blocos |
| --- | --- |
| Comandos | mostrar no log, definir variável, se/senão, alterar campo do personagem, alterar campo do item |
| Valores | número, texto, sim/não, `campo X`, `item atual . X`, variável, juntar |
| Matemática e lógica | + − × ÷ resto mín máx, arredondamentos, comparações, e/ou/não |
| Dados e crítico | rolar, natural do último d20, é crítico?, rolar dano |

Os blocos `campo` e `item atual` são menus com os campos que existem na ficha, então não dá para errar o nome.

**Blocos personalizados:** botão direito em um bloco → *Salvar como bloco personalizado…*. Ele vai para `data/blocos` e aparece na categoria **Meus blocos** de qualquer template.

## Expressões

Usadas nos campos de dados e nas fórmulas dos campos calculados:

- dados: `1d20`, `2d6+3`, `d%`
- campos pelo id: `1d8 + FOR_MOD + PROF`
- contas: `+ - * /` e parênteses (a divisão arredonda para baixo)
- funções: `piso`, `teto`, `arred`, `abs`, `min`, `max`

Campos calculados aceitam tudo isso **menos dados** — o valor precisa ser estável.

### Crítico vindo da ficha do personagem

O template só diz *quais* campos usar; os valores são de cada personagem, arma por arma:

```
rolar dano      [item atual . dano]
margem          [item atual . margemCritico]
multiplicador   [item atual . multCritico]
no crítico:     multiplica os dados | multiplica o total
```

O crítico acontece quando o **último d20 natural** da ação alcança a margem.

## Formato dos arquivos

**Template** (`versao: 2`): o layout guarda a posição (`x`, `y`, largura `w`, altura `h`) de cada elemento; cada ação guarda os blocos (`workspace`) e os comandos já compilados (`corpo`).

```json
{
  "formato": "rpg-template",
  "versao": 2,
  "id": "exemplo-dnd",
  "nome": "Exemplo D&D",
  "definicao": {
    "colunas": 12,
    "layout": [
      {
        "tipo": "painel", "titulo": "Atributos", "colunas": 6,
        "pos": { "x": 5, "y": 0, "w": 7, "h": 4 },
        "filhos": [
          { "tipo": "campo", "pos": { "x": 0, "y": 0, "w": 2, "h": 1 },
            "campo": { "id": "FOR", "tipo": "numero", "rotulo": "Força", "padrao": 10 } },
          { "tipo": "campo", "pos": { "x": 2, "y": 0, "w": 2, "h": 1 },
            "campo": { "id": "FOR_MOD", "tipo": "calculado", "rotulo": "Mod. Força", "formula": "piso((FOR-10)/2)" } }
        ]
      },
      { "tipo": "lista", "pos": { "x": 0, "y": 6, "w": 12, "h": 7 },
        "lista": { "id": "armas", "rotulo": "Armas", "formato": "cartoes", "colunas": 6, "item": ["..."] } }
    ],
    "acoes": [{ "id": "atacar", "rotulo": "Atacar", "escopo": "armas", "workspace": { "...": "..." }, "corpo": ["..."] }]
  }
}
```

**Personagem**: campos que faltarem usam o padrão do template, então o template pode evoluir.

```json
{
  "formato": "rpg-personagem",
  "versao": 1,
  "id": "thorin-exemplo",
  "nome": "Thorin (exemplo)",
  "template": "exemplo-dnd",
  "valores": {
    "FOR": 16,
    "armas": [{ "nome": "Espada longa", "dano": "1d8+FOR_MOD", "margemCritico": 19, "multCritico": 2, "efeitos": "Sangramento" }]
  }
}
```

## Estrutura do código

```
server/            API Express que lê/grava os .txt
src/shared/        rolador de dados e fórmulas, interpretador das ações, tipos
src/layout/        modelo da grade (posições, colisão), editor de layout, propriedades
src/blocks/        definições Blockly, toolbox, compilador de ações, exemplo
src/components/    célula de campo, renderização da ficha, log de rolagens
src/pages/         Início, Editor de template, Ficha do personagem
```
