# Hikari Anime

Plugin de providers de anime para o **Nuvio**, com foco em uma seleção enxuta de fontes e qualidade de vídeo.

## Providers

| Provider | Conteúdo | Qualidade |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Exclusivamente 1080p |
| Tomato | Séries de anime | Exclusivamente 1080p |

As opções de áudio originais de cada provider são preservadas. Não há fallback para resoluções inferiores.

## Instalação no Nuvio

1. Abra **Configurações → Conteúdo e descoberta → Plugins**.
2. Escolha **Adicionar repositório**.
3. Informe a URL do manifest:

   `https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

4. Atualize a lista e habilite AniZone e/ou Tomato.

O repositório está público e o manifest pode ser acessado diretamente pelo Nuvio.

## Tomato: autenticação

O Tomato usa automaticamente o token fixo da implementação upstream, declarado na constante `At` do arquivo `providers/tomato.js`. Não é necessário cadastrar token nas configurações do Nuvio. Nesta preparação, a constante está vazia: copie manualmente o valor de `At` do arquivo upstream para essa constante antes de testar. O token ficará visível no código-fonte deste repositório público.

## Formatação dos streams

## Como a restrição a 1080p funciona

- **AniZone:** o scraper exige que a playlist master anuncie uma variante de 1080p e entrega a playlist master ao player para preservar os grupos de áudio. O player continua responsável pela seleção adaptativa da variante.
- **Tomato:** aceita o identificador `FHD` e outras qualidades explicitamente reconhecidas como 1080p. O rótulo genérico `HD` não é tratado como Full HD.
- Streams sem resolução confiável ou em outras resoluções são descartadas.

A restrição é por resolução anunciada pela fonte; ela não garante um bitrate mínimo.

## Estrutura

```text
.
├── manifest.json
├── README.md
└── providers
    ├── anizone.js
    └── tomato.js
```

## Origem e atribuição

Os providers desta versão foram adaptados a partir de:

- [Kamirama-Plugin — AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)
- [Kamirama-Plugin — Tomato](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js)

O repositório upstream consultado não continha um arquivo `LICENSE` na data da preparação desta cópia. Este README registra a origem dos arquivos; não concede permissões adicionais nem declara uma licença para código de terceiros.

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
