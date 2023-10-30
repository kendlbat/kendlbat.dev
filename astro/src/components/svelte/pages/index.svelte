<script lang="ts">
    import { Heading, P, Button, Card } from "flowbite-svelte";
    import { ArrowRightOutline, LinkedinSolid } from "flowbite-svelte-icons";
    import Social from "./social.svelte";

    import FbgImage from "../../../assets/fbg.png";
    import AcscImage from "../../../assets/acsc.png";
    import HtlVillachImage from "../../../assets/htl-villach.png";
    import LicHTerLohImage from "../../../assets/lichterloh.png";
    import Fgc2023Image from "../../../assets/fgc2023.png";
</script>

<div>
    <Heading tag="h2">Hi there!</Heading>
    <P class="mb-6 mt-6 text-lg lg:text-xl">
        I'm Tobias Kendlbacher and I'm a 17 year old student from Austria.
    </P>
    <Button href="/social">
        My social media
        <ArrowRightOutline class="animate-bounce-lr ml-2 h-3.5 w-3.5" />
    </Button>
</div>
<div>
    <Heading tag="h3" class="mb-6 mt-16 text-lg lg:text-xl">
        Here are some of the things I am passionate about:
    </Heading>
    <div class="inline-block columns-1 sm:columns-2 md:columns-3 lg:columns-4">
        <Card
            class="mb-2 break-inside-avoid"
            href="https://flybyguys.com/"
            img={FbgImage.src}>
            <h5
                class="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Software Engineer at Fly-By Guys
            </h5>
            <Button class="mt-2"></Button>
        </Card>

        <Card
            href="https://verbotengut.at/"
            img={AcscImage.src}
            class="mb-2 break-inside-avoid">
            <h5
                class="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                2<sup>nd</sup> place at the Austrian Cyber Security Challenge 2023
            </h5>
        </Card>

        <Card
            href="https://htl-villach.at/"
            img={HtlVillachImage.src}
            class="mb-2 break-inside-avoid">
            <h5
                class="mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Computer Science Student at HTL Villach
            </h5>
        </Card>

        <Card
            href="https://theater-lichterloh.com/"
            img={LicHTerLohImage.src}
            class="mb-2 break-inside-avoid p-[0.5rem]">
            <h5
                class="m-[-0.5rem] mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                Actor at Theater LicHTerLoh
            </h5>
        </Card>

        <Card
            href="https://first.global/"
            img={Fgc2023Image.src}
            class="mb-2 max-w-[14rem] break-inside-avoid p-[0.5rem]">
            <h5
                class="m-[-0.5rem] mb-2 text-xl font-bold tracking-tight text-gray-900 dark:text-white">
                FIRST&reg; Global Challenge 2023
            </h5>
        </Card>
    </div>
</div>
