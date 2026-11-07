# Hikari Anime

Plugin de providers para o Nuvio, com fontes de anime e fontes gerais de filmes e séries. Os providers mantêm cartões Hikari compactos e priorizam a apresentação de idiomas para o público latino-americano.

## Providers

| Provider | Conteúdo | Comportamento |
| --- | --- | --- |
| AniZone | Filmes e séries de anime | Somente 1080p com áudio ou legenda identificada em português |
| Berry Animes | Séries de anime | Somente resultados identificados em 1080p |
| Tomato | Séries de anime | Somente resultados identificados em 1080p |
| MovieBox | Filmes e séries | API móvel e Web Player alternativo; variantes de áudio e legendas |
| MovieBox IN | Filmes e séries | Prioriza os hosts regionais IN e usa o mesmo fallback Web Player |

## Instalação no Nuvio

Adicione o manifesto na área de plugins:

https://raw.githubusercontent.com/robertmenezes/hikari-anime/main/manifest.json

Se o repositório já estiver instalado, atualize/force a atualização para buscar a nova versão dos providers.

## Cartões e idiomas

AniZone e Berry Animes usam cartões compactos Hikari, com qualidade, provider, título e informações de áudio/legendas. Os idiomas são apresentados em português sempre que identificados; português e espanhol recebem prioridade na descrição.

## AniZone

- A fonte só é retornada quando encontra pelo menos uma faixa de áudio ou legenda identificada como português.
- As faixas de legenda separadas são repassadas ao Nuvio para seleção no player.
- A extração considera os idiomas anunciados no manifesto HLS e as legendas externas fornecidas pela página do episódio.

## Berry Animes

- Provider para séries de anime, baseado no scraper do Kamirama.
- O manifesto HLS é analisado separando faixas de áudio e legendas, reconhecendo códigos ISO 639-1 e ISO 639-2/3.
- As legendas externas fornecidas pela fonte são repassadas ao Nuvio.

## Tomato

- Provider de séries de anime que mantém o fluxo original do scraper.
- A autenticação é automática; não é necessário inserir token nas configurações do Nuvio.

## MovieBox e MovieBox IN

A implementação foi reestruturada para usar duas rotas de descoberta e reprodução:

1. **API móvel:** autenticação anônima, assinatura HMAC-MD5, pesquisa por título, consulta de detalhes, descoberta de dublagens e resolução de play-info.
2. **Web Player:** quando disponível, consulta o catálogo H5 e resolve o episódio por subject/play. Essa rota também atua como fallback quando a API móvel não entrega uma fonte utilizável.

Os providers também:

- Consultam título principal, título original e títulos alternativos do TMDB para melhorar a correspondência.
- Consultam separadamente os IDs das variantes de áudio/dublagem retornados pelo MovieBox.
- Recolhem fontes de streams, HLS, DASH, MP4 e resourceDetectors quando disponíveis.
- Preservam a URL, o idioma e os dados de assinatura de cada variante; URLs iguais não são descartadas quando representam áudios diferentes.
- Reconhecem cookies de assinatura, incluindo Edge-Cache-Cookie e políticas CloudFront, e encaminham Cookie, X-MB-Token, Origin, Referer e User-Agent ao player conforme a fonte.
- Consultam legendas externas pela API móvel e as entregam ao Nuvio quando disponíveis.
- Ordenam as fontes por qualidade e destacam o idioma no nome do cartão.

### Diferenças regionais

- **MovieBox:** identifica-se como a variante global, usando o pacote/locale e os hosts globais prioritários.
- **MovieBox IN:** identifica-se como a variante indiana e prioriza os hosts IN.
- As duas variantes compartilham a lógica de reprodução, mas mantêm configurações regionais separadas.
- O Web Player H5 é uma rota complementar e pode retornar fontes que não aparecem na API móvel.

A lista de formatos no manifesto descreve os formatos que o provider consegue identificar; a disponibilidade real depende do título, do episódio e da resposta atual do serviço.

## Comportamento geral

- AniZone, Berry Animes e Tomato mantêm o filtro estrito de 1080p.
- MovieBox e MovieBox IN não aplicam o filtro de 1080p: entregam as qualidades encontradas em ordem decrescente.
- As faixas de áudio e as legendas externas identificadas são apresentadas ao Nuvio para seleção durante a reprodução.

## Estrutura

    .
    ├── manifest.json
    └── providers
        ├── anizone.js
        ├── berryanimes.js
        ├── moviebox.js
        ├── movieboxin.js
        └── tomato.js

## Origem e referências

Os providers de anime foram adaptados dos seguintes arquivos do Kamirama:

- AniZone: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/anizone.js
- Berry Animes: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/berryanimes.js
- Tomato: https://github.com/kaminarizz/Kamirama-Plugin/blob/main/providers/tomato.js

A integração MovieBox foi implementada para o runtime de plugins do Nuvio com base no comportamento observado nos pacotes Cloudstream fornecidos para análise e em referências públicas da API móvel e do Web Player. O Hikari não importa a infraestrutura do Stremio ou a do Cloudstream.

O Hikari Anime não hospeda vídeos ou arquivos de mídia. Os providers consultam fontes de terceiros; utilize-os de acordo com as leis e os termos aplicáveis.
