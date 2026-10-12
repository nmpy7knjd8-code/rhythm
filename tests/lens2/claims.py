W=lambda s:'https://en.wikipedia.org/wiki/'+s
P88='http://jeffporcaro.blogspot.com/p/blog-page_12.html'
GC='http://www.soad.msk.ru/articles/john_dolmayan_interview_2002_guitarcenter.com.htm'
MR_D='https://www.musicradar.com/news/drums/system-of-a-downs-john-dolmayan-picks-10-essential-drum-albums-602710'
MD_D='https://www.moderndrummer.com/2004/05/john-dolmayan/'
G10='http://www.fooarchive.com/features/moderndrummer10.htm'; G08='https://www.moderndrummer.com/2008/08/drum-god-dave-grohl/'
A08='https://www.moderndrummer.com/2008/01/alex-van-halen/'; A95='https://earofnewt.com/2024/12/04/word-for-word-with-alex-van-halen-the-complete-interview-august-9-1995/'
C74='http://www.jazzprofessional.com/interviews/Billy%20Cobham.htm'; CMR='https://www.musicradar.com/news/drums/billy-cobham-on-his-stellar-70s-solo-run-and-gear-evolution-634404'
RMR='https://www.musicradar.com/news/phil-rudd-talks-his-dc-departure-head-job-and-coming-back-from-the-brink'; RMD='https://www.moderndrummer.com/2011/05/phil-rudd-the-very-definition-of-rock-drumming/'
P07='https://www.moderndrummer.com/2007/08/mike-portnoy-2/'; P04='https://www.moderndrummer.com/2004/05/mike-portnoy/'
B8='http://jazzpro.nationaljazzarchive.org.uk/interviews/Buddy%20Rich_8.htm'; BT='https://scottkfish.com/2014/09/27/mel-torme-interviews-buddy-rich-a-classic-interview/'
T10='https://www.moderndrummer.com/2010/03/travis-barker-3/'; T05='https://www.moderndrummer.com/2005/05/travis-barker/'
S11='https://www.moderndrummer.com/2011/08/chad-smith-3/'; S12='https://www.moderndrummer.com/2012/02/chad-smith-arriving-magic-take/'
SE='https://somethingelsereviews.com/2012/09/27/steve-gadd-on-aja-50-ways-to-leave-your-lover-take-it-away-others/'; G05='https://www.moderndrummer.com/2005/07/steve-gadd/'
TW='https://cruiseshipdrummer.com/2011/04/24/1978-modern-drummer-interview-tony-williams/'
# (section, claim, url, keywords that must appear on the page)
C={
'Jeff Porcaro':[
 ('signature_techniques',"The 'Rosanna shuffle': a half-time shuffle he said took its inspiration from Bernard Purdie (\"Home at Last\") and, by Toto's account, John Bonham.",P88,['Rosanna','Purdie','Home At Last']),
 ('signature_techniques','Built the groove of "Africa" from a one-bar tape loop of drums and percussion played with Lenny Castro, rather than a drum machine.',P88,['one-bar tape loop','Lenny Castro','Linn']),
 ('signature_techniques','"Hold the Line" was him playing a Sly Stone, Greg Errico-style groove: triplets on the hi-hat under a hard rock backbeat.',P88,['Greg Errico','triplets']),
 ('feel','Credited his 16th-note feel to Paul Humphrey, Ed Greene, Earl Palmer and James Gadson, and his ballad playing to Jim Keltner, aiming to leave space.',P88,['Keltner','Earl Palmer','space']),
 ('gear','In 1988: Pearl jazz-size toms (10, 12, 13, 14 and a 16 floor), an 18x22 bass drum, piccolo and metal snares, a Ludwig Black Beauty, and Paiste cymbals.',P88,['Pearl jazz-size toms','Black Beauty','Paiste']),
 ('impact','Founding member of Toto and one of the most recorded session drummers of his era, including Steely Dan and Boz Scaggs. He died in 1992, aged 38.',W('Jeff_Porcaro'),['Toto','Steely Dan','Boz Scaggs','1992']),
],
'John Dolmayan':[
 ('signature_techniques','Says he has always focused on his hands more than his feet; later System material pushed him to two bass drums instead of a double pedal.',MD_D,['hands than on my feet','switched to two']),
 ('arranging','The band folds jazz, funk, metal, traditional Armenian, Middle Eastern and Latin music into its sound, which shapes his abrupt, stop-start parts.',GC,['Armenian','Middle Eastern','Latin']),
 ('influences','Built his style playing along to records across genres. He names Keith Moon as his favorite drummer and Stewart Copeland as a huge influence.',MR_D,['Keith Moon','Stewart Copeland']),
 ('gear','In 2002: a Tama kit with five toms and a double pedal, timbales for a few songs, Paiste cymbals (around eleven), Remo heads and Bickford sticks.',GC,['Tama','Paiste','Remo','Bickford','Timbales']),
 ('impact','Drummer of System of a Down since 1997, replacing Andy Khachaturian.',W('John_Dolmayan'),['1997','Khachaturian']),
],
'Dave Grohl':[
 ('signature_techniques','Plays parts as hooks: on Queens of the Stone Age and Them Crooked Vultures songs he says he was mimicking Josh Homme\'s guitar riffs on the drums.',G10,['mimicking his riff','Josh Homme']),
 ('feel','Values consistency over perfect time; he plays to the room in the studio and says "Teen Spirit" sounded bigger because he played less.',G10,['Consistency is very important','play to the room','doing less']),
 ('feel','Self-taught; he says he never studied drums and does not read music.',G08,['never studied drums','read']),
 ('influences','Calls Dale Crover of the Melvins the best drummer in the world, and calls John Bonham "the greatest rock drummer of all time".',G10,['greatest rock drummer of all time']),
 ('impact','Nirvana\'s drummer from 1990 (Nevermind, In Utero). He then founded Foo Fighters and drummed on Queens of the Stone Age\'s Songs for the Deaf and with Them Crooked Vultures.',W('Dave_Grohl'),['Nevermind','Foo Fighters','Songs for the Deaf','Them Crooked Vultures']),
],
'Alex Van Halen':[
 ('signature_techniques','Uses two bass drums mainly for speed on shuffles, and in the studio often works from a small kit: snare, kick, hi-hat, a cymbal and maybe one tom.',A08,['two bass drums','shuffles','one tom']),
 ('influences','Ginger Baker was his first model, a drummer who "made music on his drums". He also cites Bonham and Keith Moon, and prefers Louie Bellson to Buddy Rich.',A95,['Ginger Baker','Bonham','Keith Moon','Louie Bellson']),
 ('feel','His aim is to be in the moment: rehearse, but leave room to make every night different.',A08,['in the moment','every night different']),
 ('impact','Co-founded Van Halen with his brother Eddie and played on all of the band\'s studio albums.',W('Alex_Van_Halen'),['Eddie','Van Halen']),
],
'Billy Cobham':[
 ('signature_techniques','Large kits with two bass drums. The Mahavishnu Orchestra years pushed him to explore double bass after starting on a single kick.',CMR,['bass drum','Mahavishnu']),
 ('feel','Says the Mahavishnu Orchestra gave him complete freedom; as a leader he sets up a framework and leaves room to improvise.',C74,['completely free','framework']),
 ('influences','Grew up in a family of drummers from Panama, hearing Latin and steel-drum music. He names Miles Davis, Tony Williams and Max Roach as landmarks.',C74,['Panama','Tony Williams','Max Roach']),
 ('impact','Played on Miles Davis records and with the Mahavishnu Orchestra. His 1973 solo debut Spectrum (with "Stratus") is a jazz-rock touchstone.',W('Billy_Cobham'),['Mahavishnu','Spectrum','Miles Davis']),
],
'Phil Rudd':[
 ('signature_techniques','A steady, unadorned backbeat played for the song; he rarely fills and never built a drum solo into the AC/DC show.',RMR,['drum solo','groove and the feel']),
 ('feel','He hits hard, he says, because in the early days he had to be heard over walls of Marshalls, but "it\'s always about the groove and the feel".',RMR,['Marshalls','hit hard']),
 ('influences','Names Ringo Starr ("the greatest"), Simon Kirke and Ian Paice.',RMR,['Simon Kirke','Ian Paice']),
 ('impact','AC/DC\'s drummer from 1975 to 1983 and again from 1994, including Highway to Hell and Back in Black. Rammstein\'s Christoph Schneider called the band simple but "not so easy to copy".',RMD,['1975','Back In Black','not so easy to copy']),
],
'Mike Portnoy':[
 ('signature_techniques','Odd meters are central. He learned them by following piano and guitar songbooks of Rush and Yes records and counting the time signatures.',P07,['songbooks','time signatures']),
 ('influences','His biggest progressive influence was Neil Peart, along with Bill Bruford and other prog drummers, after The Who, Led Zeppelin and The Beatles.',P07,['Neil Peart','Bruford']),
 ('gear','Famous for very large kits; his early-2000s touring "Siamese Monster" combined a big traditional kit with a smaller second setup.',P04,['Siamese Monster']),
 ('impact','Co-founded Dream Theater at Berklee in 1985, left in 2010 and later rejoined.',W('Mike_Portnoy'),['Berklee','Dream Theater','2010']),
],
'Buddy Rich':[
 ('signature_techniques','Treated single strokes and the roll as the core of technique: fast singles close into a roll, and wrist control makes it sound like tearing sandpaper.',BT,['single strokes','sandpaper']),
 ('feel','Self-taught; he says he never had a lesson. He felt a perfectly steady tempo was too mechanical to swing and preferred a band that pushes.',B8,['never had any lessons','mechanical']),
 ('influences','Called Chick Webb the greatest drummer who ever lived.',B8,['Chick Webb']),
 ('impact','A child vaudeville star ("Traps the Drum Wonder") who played with Artie Shaw and Tommy Dorsey and later led his own big band.',W('Buddy_Rich'),['Traps','Artie Shaw','Dorsey']),
],
'Gene Krupa':[
 ('signature_techniques','His tom-tom interludes on Benny Goodman\'s "Sing, Sing, Sing" were the first extended drum solos recorded commercially.',W('Gene_Krupa'),['Sing, Sing, Sing','first extended drum solos']),
 ('impact','He raised the drummer from accompanist to solo voice. In 1978 he became the first drummer inducted into the Modern Drummer Hall of Fame.',W('Gene_Krupa'),['Modern Drummer Hall of Fame','accompanist']),
 ('impact','Joined Goodman in December 1934 and left after the January 1938 Carnegie Hall concert to lead his own orchestra.',W('Gene_Krupa'),['1934','Carnegie Hall']),
],
'Travis Barker':[
 ('feel','Studied jazz from a young age and played in his high school jazz ensemble and marching band. He rejects the "punk drummer" label.',T10,['jazz','marching band','punk']),
 ('arranging','On the untitled 2003 blink-182 album many songs began from his drum ideas; he also tracked songs with both big and small kits.',T05,['ideas came from the drum parts','small drums']),
 ('impact','Joined blink-182 in 1998 (first full album: Enema of the State) and has worked widely in hip-hop and pop as well.',W('Travis_Barker'),['1998','Enema of the State']),
],
'Chad Smith':[
 ('arranging','Trusts first instincts: about 80% of the time his first idea becomes the part. He shapes his parts around Anthony Kiedis\'s rhythmic vocals.',S12,['Eighty percent','Anthony sings']),
 ('influences','Started with Ian Paice, then emulated Mitch Mitchell, Bill Ward and John Bonham for their "jazzy swing". Later Stewart Copeland and Neil Peart.',S11,['Ian Paice','Mitch','jazzy swing']),
 ('impact','Red Hot Chili Peppers drummer since 1988; also Chickenfoot.',W('Chad_Smith'),['1988','Chickenfoot']),
],
'Steve Gadd':[
 ('signature_techniques','The "50 Ways to Leave Your Lover" intro grew out of drum-corps-style patterns he was practicing between takes: hi-hat, snare and bass drum, hi-hat with the left hand.',SE,['drum and bugle corps','between takes','left hand']),
 ('arranging','The "Aja" drums were cut live with the band, and Wayne Shorter overdubbed his solo afterwards.',SE,['Wayne overdubbed']),
 ('influences','Grew up on Krupa, Buddy Rich, Max Roach, Elvin Jones, Philly Joe Jones, Tony Williams and Art Blakey. Then New York funk players turned him toward the groove.',G05,['Krupa','Elvin Jones','groove']),
 ('impact','One of the most recorded drummers in pop and jazz, with Paul Simon, Steely Dan, Eric Clapton, Chick Corea and James Taylor.',W('Steve_Gadd'),['Paul Simon','Clapton','Chick Corea']),
],
'Tony Williams':[
 ('feel','In his words, the drummer\'s first job is time, then bridging the other instruments and making them comfortable.',TW,['first responsibility is time','bridge']),
 ('signature_techniques','Studied privately with Alan Dawson, and practiced hands on a pad for hours a day; he considered his hands the most important thing.',TW,['Alan Dawson','pad']),
 ('influences','Named Max Roach, Philly Joe Jones, Art Blakey, Jo Jones, Sid Catlett and Kenny Clarke.',TW,['Max','Catlett','Kenny Clarke']),
 ('impact','Joined Miles Davis\'s quintet at 17 and later led the fusion band Lifetime. He died in 1997.',W('Tony_Williams_(drummer)'),['Miles Davis','Lifetime','1997']),
],
}
