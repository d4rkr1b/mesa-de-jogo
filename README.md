# Mesa de Jogo

App para o iPad (e web) com estatísticas de basket: registo de jogo ao vivo, mapa de lançamentos, ficha de jogo, quintetos, exercícios de lançamento no treino e fichas das atletas.

Funciona sem internet e instala-se no ecrã principal do iPad. Os dados ficam guardados no dispositivo (IndexedDB). A página **Atletas → Cópia de segurança** exporta e importa tudo num ficheiro `.json`.

## Correr no PC

```bash
npm install
npm run dev
```

Abre http://localhost:5173.

## Publicar

Cada `git push` para o ramo `main` publica a app no GitHub Pages (`.github/workflows/deploy.yml`). No repositório, em **Settings → Pages**, a fonte tem de ser **GitHub Actions**.

## Estrutura

- `src/main.js`: arranque, cabeçalho, separadores e relógio
- `src/state.js`: dados e gravação no dispositivo
- `src/stats.js`: cálculo das estatísticas (eFG%, TS%, posses, quintetos, leitura automática)
- `src/court.js`: geometria do campo FIBA e posições de treino
- `src/chart.js`: gráfico de evolução
- `src/sample.js`: dados de exemplo e exercícios de base
- `src/views/`: `games` (época e jogos), `live` (registo), `reports` (ficha, lançamentos, quintetos), `train` (treino), `athletes` (plantel, fichas, treinos realizados, cópias)
- `prototipo.html`: o protótipo original, para referência
