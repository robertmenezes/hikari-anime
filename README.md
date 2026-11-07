# Hikari Anime

Plugin de providers de anime para o **Nuvio**, baseado nos scrapers do Kamirama, mantendo a lógica original de extração sempre que possível.

## Providers

| Provider | Conteúdo | Filtro |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Somente resultados identificados em 1080p |
| Tomato | Séries de anime | Somente resultados identificados em 1080p |

## Instalação no Nuvio

Adicione este manifest na área de plugins:

`https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json`

Se o repositório já estiver instalado, atualize/force a atualização do repositório para buscar a nova versão dos providers.

**AniZone:** a indicação `Multi` se refere exclusivamente a múltiplas faixas de áudio identificadas na playlist. Quando o player da fonte fornece uma faixa de legenda em português e não há áudio em português, o resultado também recebe a indicação `Legendado`. As faixas de legenda separadas são repassadas ao Nuvio para seleção no player.

**AniZone — identificação de áudio:** uma faixa é apresentada pelo código do idioma; duas faixas são identificadas como `DUAL`; três ou mais como `Multi`. Esses rótulos descrevem somente as faixas de áudio declaradas pela playlist, não a disponibilidade de legendas.

O AniZone também reconhece idiomas anunciados pela playlist HLS em `TYPE=SUBTITLES` e `TYPE=CLOSED-CAPTIONS`. A indicação `Legendado` no cartão é baseada na presença de uma faixa de legenda em português fornecida separadamente pelo player da fonte ou declarada na playlist, e na ausência de áudio em português.

## Comportamento

- Os scrapers mantêm a estrutura e o formatter de saída do Kamirama.
- As opções originais de áudio são preservadas.
- O filtro só exibe resultados cuja qualidade seja identificada como 1080p.
- Não existe fallback para 720p, 480p ou qualidades inferiores.
- O Tomato utiliza sua autenticação automática original; não é necessário inserir token nas configurações do Nuvio.

## Estrutura

```text
.
├── manifest.json
└── providers
    ├── anizone.js
    └── tomato.js
```

## Origem

Os providers foram adaptados dos seguintes arquivos do Kamirama:

- [AniZone](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js)
- [Tomato](https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js)

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
