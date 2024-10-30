import React from 'react';
import Link from 'next/link';

function Footer() {
    return (
        <section className="max-w-7xl mx-auto border-t px-4">
            <div className="flex justify-between py-8">
                <p className="text-primary tracking-tight">
                    Designed and Developed by{' '}
                    <Link href={'https://instagram.com'} className="font-bold">
                        Rokum
                    </Link>
                </p>
            </div>
        </section>
    );
}

export default Footer;
