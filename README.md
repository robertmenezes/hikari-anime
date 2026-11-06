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

O repositório está privado durante a preparação; para instalar diretamente pelo Nuvio, o manifest precisará estar acessível ao aplicativo.

## Tomato: autenticação

O Tomato requer um token de acesso. Por segurança, o token fixo encontrado no código upstream não é armazenado neste repositório. Abra as configurações do provider Tomato no Nuvio e informe um token que você esteja autorizado a utilizar. O valor é lido de `SCRAPER_SETTINGS.tomatoToken`; ele não é incluído nos arquivos versionados do Hikari Anime.

A interface atual do Nuvio apresenta campos do tipo texto sem aplicar mascaramento visual ao valor; evite compartilhar capturas de tela das configurações.

## Como a restrição a 1080p funciona

- **AniZone:** o scraper procura uma variante HLS cuja resolução declarada seja exatamente 1080p e entrega essa variante ao player, em vez da playlist master adaptativa. Se não houver variante identificada em 1080p, não retorna stream.
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
